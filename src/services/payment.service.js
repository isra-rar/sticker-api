const PaymentRepository = require("../repositories/payment.repository");
const OrderRepository = require("../repositories/order.repository");
const OrderService = require("./order.service");

class PaymentService {
    normalizeStatus(rawStatus) {
        const status = String(rawStatus || "").trim().toUpperCase();
        const map = {
            APPROVED: "APPROVED",
            PAID: "APPROVED",
            FAILED: "FAILED",
            REFUNDED: "REFUNDED",
            CANCELLED: "CANCELLED",
            CANCELED: "CANCELLED",
            PENDING: "PENDING"
        };

        if (!map[status]) {
            const error = new Error("Status de pagamento invalido.");
            error.code = "INVALID_PAYMENT_STATUS";
            error.status = 400;
            throw error;
        }

        return map[status];
    }

    async processWebhook(payload) {
        if (!payload || typeof payload !== "object") {
            const error = new Error("Payload do webhook invalido.");
            error.code = "INVALID_WEBHOOK_PAYLOAD";
            error.status = 400;
            throw error;
        }

        if (!payload.paymentId && !payload.gatewayPaymentId && !payload.orderId) {
            const error = new Error("Webhook precisa de paymentId, gatewayPaymentId ou orderId.");
            error.code = "INVALID_WEBHOOK_IDENTIFIER";
            error.status = 400;
            throw error;
        }

        const status = this.normalizeStatus(payload.status);
        let payment = null;

        if (payload.paymentId) {
            payment = await PaymentRepository.findById(payload.paymentId);
        }

        if (!payment && payload.gatewayPaymentId) {
            payment = await PaymentRepository.findByGatewayPaymentId(payload.gatewayPaymentId);
        }

        if (!payment && payload.orderId) {
            payment = await PaymentRepository.findByOrderId(payload.orderId);
        }

        if (!payment) {
            const error = new Error("Pagamento nao encontrado para o webhook informado.");
            error.code = "PAYMENT_NOT_FOUND";
            error.status = 404;
            throw error;
        }

        if (payment.status === "APPROVED" && status !== "APPROVED") {
            const existingOrder = await OrderRepository.findById(payment.orderId);
            return {
                payment,
                order: existingOrder
            };
        }

        if (payment.status === status && status !== "APPROVED") {
            const existingOrder = await OrderRepository.findById(payment.orderId);
            return {
                payment,
                order: existingOrder
            };
        }

        const paidAt = status === "APPROVED"
            ? (payment.paidAt || new Date())
            : null;

        const nextOrderStatus = status === "APPROVED"
            ? "PAID"
            : (status === "PENDING" ? "WAITING_PAYMENT" : "FAILED");

        const { payment: updatedPayment, order: updatedOrder } = await PaymentRepository.updatePaymentAndOrder({
            paymentId: payment.id,
            orderId: payment.orderId,
            paymentData: {
            status,
            gatewayPaymentId: payload.gatewayPaymentId || payment.gatewayPaymentId,
            providerPayload: payload,
            paidAt
            },
            orderData: {
                status: nextOrderStatus
            }
        });

        OrderService.invalidateDownloadCache(updatedOrder.id);

        return {
            payment: updatedPayment,
            order: updatedOrder
        };
    }
}

module.exports = new PaymentService();
