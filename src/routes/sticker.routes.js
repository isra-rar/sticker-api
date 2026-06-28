const express = require("express");
const multer = require("multer");
const path = require("path");
const { generateSticker } = require("../controllers/sticker.controller");
const {
    createRateLimiter,
    requireApiKey
} = require("../middlewares/security.middleware");

const router = express.Router();

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}${path.extname(file.originalname)}`;
        cb(null, fileName);
    }
});

const upload = multer({ storage });
const generateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    keyPrefix: "sticker-generate"
});

router.post(
    "/generate",
    requireApiKey,
    generateLimiter,
    upload.single("photo"),
    generateSticker
);

module.exports = router;