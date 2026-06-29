const OrderService = require("../services/order.service");
const fs = require("fs/promises");
const path = require("path");

function isTruthyFlag(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ["1", "true", "yes", "sim", "on"].includes(normalized);
}

exports.generateSticker = async (req, res) => {
    try {
        const { order, payment } = await OrderService.createAndGenerate({
            files: {
                photo: req.file || null
            },
            payload: req.body
        });

        const previewUrl = `${req.protocol}://${req.get("host")}/${order.imagePreviewPath}`;
        const shouldIncludePreviewBase64 = isTruthyFlag(
            req.query.includePreviewBase64 || req.body.includePreviewBase64
        );

        let previewImageBase64;
        if (shouldIncludePreviewBase64 && order.imagePreviewPath) {
            const absolutePreviewPath = path.resolve(__dirname, "..", "..", order.imagePreviewPath);
            const previewBuffer = await fs.readFile(absolutePreviewPath);
            previewImageBase64 = previewBuffer.toString("base64");
        }

        return res.status(200).json({
            success: true,
            message: "Pedido criado e figurinha gerada com sucesso.",
            orderId: order.id,
            orderStatus: order.status,
            paymentId: payment?.id || null,
            paymentStatus: payment?.status || null,
            previewImagePath: order.imagePreviewPath,
            previewImageUrl: previewUrl,
            previewImageBase64: shouldIncludePreviewBase64 ? previewImageBase64 : undefined
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