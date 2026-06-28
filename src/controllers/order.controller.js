const OrderService = require("../services/order.service");

exports.downloadOrderImage = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID do pedido e obrigatorio."
            });
        }

        const result = await OrderService.getDownloadTarget(id);
        const imageUrl = `${req.protocol}://${req.get("host")}/${result.imagePath}`;

        return res.status(200).json({
            success: true,
            orderId: result.orderId,
            orderStatus: result.status,
            imagePath: result.imagePath,
            imageUrl
        });
    } catch (err) {
        return res.status(err.status || 500).json({
            success: false,
            code: err.code || "INTERNAL_ERROR",
            message: err.message || "Erro ao consultar download do pedido."
        });
    }
};
