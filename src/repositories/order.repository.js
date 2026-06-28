const prisma = require("../services/prisma.service");

class OrderRepository {
    create(data) {
        return prisma.order.create({ data });
    }

    updateById(id, data) {
        return prisma.order.update({
            where: { id },
            data
        });
    }

    findById(id) {
        return prisma.order.findUnique({
            where: { id },
            include: { payment: true }
        });
    }

    findByPaymentId(paymentId) {
        return prisma.order.findFirst({
            where: { paymentId },
            include: { payment: true }
        });
    }
}

module.exports = new OrderRepository();
