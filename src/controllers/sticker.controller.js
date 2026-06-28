const OrderService = require("../services/order.service");

exports.generateSticker = async (req, res) => {
    try {
        const { order, payment } = await OrderService.createAndGenerate({
            file: req.file,
            payload: req.body
        });

        const previewUrl = `${req.protocol}://${req.get("host")}/${order.imagePreviewPath}`;

        return res.status(200).json({
            success: true,
            message: "Pedido criado e figurinha gerada com sucesso.",
            orderId: order.id,
            orderStatus: order.status,
            paymentId: payment.id,
            paymentStatus: payment.status,
            previewImagePath: order.imagePreviewPath,
            previewImageUrl: previewUrl
        });
    } catch (err) {
        console.error(err);

        return res.status(err.status || 500).json({
            success: false,
            code: err.code || "INTERNAL_ERROR",
            message: err.message || "Erro interno ao gerar figurinha.",
            details: process.env.NODE_ENV === "development" ? err.details : undefined
        });
    }
};