const crypto = require("crypto");

const buckets = new Map();

function safeCompare(expected, received) {
    const expectedBuffer = Buffer.from(String(expected || ""));
    const receivedBuffer = Buffer.from(String(received || ""));

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        return String(forwarded).split(",")[0].trim();
    }

    return req.ip || req.socket?.remoteAddress || "unknown";
}

function normalizeIp(ip) {
    const value = String(ip || "").trim();
    if (!value) {
        return "";
    }

    if (value.startsWith("::ffff:")) {
        return value.replace("::ffff:", "");
    }

    return value;
}

function parseAllowedIps(value) {
    return String(value || "")
        .split(",")
        .map((item) => normalizeIp(item))
        .filter(Boolean);
}

function createRateLimiter({ windowMs, max, keyPrefix }) {
    return (req, res, next) => {
        const now = Date.now();
        const ip = getClientIp(req);
        const key = `${keyPrefix}:${ip}`;
        const current = buckets.get(key);

        if (!current || current.resetAt <= now) {
            buckets.set(key, {
                count: 1,
                resetAt: now + windowMs
            });
            return next();
        }

        current.count += 1;

        if (current.count > max) {
            return res.status(429).json({
                success: false,
                code: "RATE_LIMIT_EXCEEDED",
                message: "Muitas tentativas. Tente novamente mais tarde."
            });
        }

        return next();
    };
}

function extractSecretFromRequest(req) {
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
        return apiKey;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.replace("Bearer ", "").trim();
    }

    return "";
}

function requireApiKey(req, res, next) {
    const expected = process.env.API_PRIVATE_KEY;

    if (!expected) {
        return res.status(503).json({
            success: false,
            code: "SECURITY_NOT_CONFIGURED",
            message: "Chave de seguranca da API nao configurada."
        });
    }

    const received = extractSecretFromRequest(req);

    if (!safeCompare(expected, received)) {
        return res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: "Nao autorizado."
        });
    }

    return next();
}

function requireWebhookSecret(req, res, next) {
    const expected = process.env.WEBHOOK_SECRET;

    if (!expected) {
        return res.status(503).json({
            success: false,
            code: "WEBHOOK_SECRET_NOT_CONFIGURED",
            message: "Segredo do webhook nao configurado."
        });
    }

    const received = req.headers["x-webhook-secret"] || "";

    if (!safeCompare(expected, received)) {
        return res.status(401).json({
            success: false,
            code: "WEBHOOK_UNAUTHORIZED",
            message: "Webhook nao autorizado."
        });
    }

    return next();
}

function requireWebhookSignature(req, res, next) {
    const secret = process.env.WEBHOOK_SIGNATURE_SECRET;

    if (!secret) {
        return res.status(503).json({
            success: false,
            code: "WEBHOOK_SIGNATURE_NOT_CONFIGURED",
            message: "Assinatura do webhook nao configurada."
        });
    }

    const timestamp = req.headers["x-webhook-timestamp"];
    const signature = req.headers["x-webhook-signature"];

    if (!timestamp || !signature) {
        return res.status(401).json({
            success: false,
            code: "WEBHOOK_SIGNATURE_MISSING",
            message: "Assinatura do webhook ausente."
        });
    }

    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber)) {
        return res.status(401).json({
            success: false,
            code: "WEBHOOK_TIMESTAMP_INVALID",
            message: "Timestamp do webhook invalido."
        });
    }

    const maxAgeSeconds = Number(process.env.WEBHOOK_MAX_AGE_SECONDS || 300);
    const currentEpoch = Math.floor(Date.now() / 1000);
    if (Math.abs(currentEpoch - timestampNumber) > maxAgeSeconds) {
        return res.status(401).json({
            success: false,
            code: "WEBHOOK_SIGNATURE_EXPIRED",
            message: "Webhook expirado."
        });
    }

    const rawBody = req.rawBody || "";
    const payloadToSign = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

    if (!safeCompare(expected, signature)) {
        return res.status(401).json({
            success: false,
            code: "WEBHOOK_SIGNATURE_INVALID",
            message: "Assinatura do webhook invalida."
        });
    }

    return next();
}

function requireWebhookIpWhitelist(req, res, next) {
    const allowedIps = parseAllowedIps(process.env.WEBHOOK_ALLOWED_IPS);

    if (!allowedIps.length) {
        return res.status(503).json({
            success: false,
            code: "WEBHOOK_IP_WHITELIST_NOT_CONFIGURED",
            message: "Whitelist de IP do webhook nao configurada."
        });
    }

    const requestIp = normalizeIp(getClientIp(req));

    if (!allowedIps.includes(requestIp)) {
        return res.status(403).json({
            success: false,
            code: "WEBHOOK_IP_NOT_ALLOWED",
            message: "IP nao autorizado para webhook."
        });
    }

    return next();
}

function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
}

function blockSuspiciousRequests(req, res, next) {
    const raw = String(req.originalUrl || "").toLowerCase();
    const decoded = decodeURIComponent(raw);
    const suspiciousPattern = /(\.\.|%2e%2e|\/\.git|wp-admin|phpmyadmin|\.env|\.sql|\.bak)/i;

    if (suspiciousPattern.test(decoded)) {
        return res.status(404).json({
            success: false,
            message: "Rota nao encontrada."
        });
    }

    return next();
}

module.exports = {
    createRateLimiter,
    requireApiKey,
    requireWebhookSecret,
    requireWebhookIpWhitelist,
    requireWebhookSignature,
    securityHeaders,
    blockSuspiciousRequests
};
