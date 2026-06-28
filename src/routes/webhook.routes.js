const express = require("express");
const { paymentWebhook } = require("../controllers/payment.controller");
const {
	createRateLimiter,
	requireWebhookSecret,
	requireWebhookIpWhitelist,
	requireWebhookSignature
} = require("../middlewares/security.middleware");

const router = express.Router();
const webhookLimiter = createRateLimiter({
	windowMs: 60 * 1000,
	max: 120,
	keyPrefix: "payment-webhook"
});

router.post("/payment", requireWebhookIpWhitelist, requireWebhookSecret, requireWebhookSignature, webhookLimiter, paymentWebhook);

module.exports = router;
