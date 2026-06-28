require("dotenv").config();

const express = require("express");
const cors = require("cors");

const stickerRoutes = require("./routes/sticker.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/sticker", stickerRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Sticker API funcionando 🚀"
    });
});

app.listen(process.env.PORT, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT}`);
});