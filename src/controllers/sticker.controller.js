exports.generateSticker = async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Nenhuma imagem enviada."
            });
        }

        console.log(req.file);

        console.log(req.body);

        return res.json({
            success: true,
            message: "Imagem recebida com sucesso!",
            file: req.file.filename,
            data: req.body
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};