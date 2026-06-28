const PaymentService = require("../services/payment.service");

exports.paymentWebhook = async (req, res) => {
    try {
        const result = await PaymentService.processWebhook(req.body);

        return res.status(200).json({
            success: true,
            message: "Webhook processado com sucesso.",
            paymentId: result.payment.id,
            paymentStatus: result.payment.status,
            orderId: result.order.id,
            orderStatus: result.order.status,
            paidAt: result.payment.paidAt
        });
    } catch (err) {
        return res.status(err.status || 500).json({
            success: false,
            code: err.code || "INTERNAL_ERROR",
            message: err.message || "Erro ao processar webhook de pagamento."
        });
    }
};
