const prisma = require("../services/prisma.service");

class PaymentRepository {
    create(data) {
        return prisma.payment.create({ data });
    }

    updateById(id, data) {
        return prisma.payment.update({
            where: { id },
            data
        });
    }

    findById(id) {
        return prisma.payment.findUnique({ where: { id } });
    }

    findByGatewayPaymentId(gatewayPaymentId) {
        return prisma.payment.findUnique({ where: { gatewayPaymentId } });
    }

    findByOrderId(orderId) {
        return prisma.payment.findUnique({ where: { orderId } });
    }

    async updatePaymentAndOrder({ paymentId, paymentData, orderId, orderData }) {
        return prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: paymentData
            });

            const order = await tx.order.update({
                where: { id: orderId },
                data: orderData
            });

            return { payment, order };
        });
    }
}

module.exports = new PaymentRepository();
