const express = require("express");
const multer = require("multer");
const path = require("path");
const { generateSticker } = require("../controllers/sticker.controller");

const router = express.Router();

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}${path.extname(file.originalname)}`;
        cb(null, fileName);
    }
});

const upload = multer({ storage });

router.post(
    "/generate",
    upload.single("photo"),
    generateSticker
);

module.exports = router;