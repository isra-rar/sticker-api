require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const stickerRoutes = require("./routes/sticker.routes");
const orderRoutes = require("./routes/order.routes");
const webhookRoutes = require("./routes/webhook.routes");
const {
    securityHeaders,
    blockSuspiciousRequests
} = require("./middlewares/security.middleware");

const app = express();

function parseAllowedOrigins(value) {
    return String(value || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function buildCorsOptions() {
    const env = process.env.NODE_ENV || "development";
    const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);

    return {
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            if (env !== "production" && !allowedOrigins.length) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-webhook-secret"]
    };
}

function getOutputCacheSeconds() {
    const value = Number(process.env.OUTPUT_CACHE_MAX_AGE_SECONDS || 3600);
    if (!Number.isFinite(value) || value < 0) {
        return 3600;
    }

    return value;
}

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true");
app.use(cors(buildCorsOptions()));
app.use(securityHeaders);
app.use(blockSuspiciousRequests);
app.use(express.json({
    limit: "1mb",
    verify(req, res, buf) {
        req.rawBody = buf.toString("utf8");
    }
}));
app.use("/output", express.static(path.resolve(__dirname, "..", "output"), {
    maxAge: getOutputCacheSeconds() * 1000,
    etag: true
}));

app.use("/api/sticker", stickerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/orders", orderRoutes);
app.use("/webhooks", webhookRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Sticker API funcionando 🚀"
    });
});

app.use((err, req, res, next) => {
    if (err && err.message === "Not allowed by CORS") {
        return res.status(403).json({
            success: false,
            code: "CORS_FORBIDDEN",
            message: "Origem nao permitida."
        });
    }

    return next(err);
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Rota nao encontrada."
    });
});

app.listen(process.env.PORT, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT}`);
});