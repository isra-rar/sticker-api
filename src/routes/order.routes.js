const express = require("express");
const { downloadOrderImage } = require("../controllers/order.controller");
const {
	createRateLimiter,
	requireApiKey
} = require("../middlewares/security.middleware");

const router = express.Router();
const downloadLimiter = createRateLimiter({
	windowMs: 60 * 1000,
	max: 60,
	keyPrefix: "order-download"
});

router.get("/:id/download", requireApiKey, downloadLimiter, downloadOrderImage);

module.exports = router;
