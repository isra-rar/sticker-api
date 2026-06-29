const path = require("path");
const sharp = require("sharp");
const OpenAI = require("openai");
const { toFile } = require("openai");

class OpenAIService {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
        this.size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
    }

    async buildUploadFile(imagePath) {
        const imageBuffer = await sharp(imagePath)
            .png()
            .toBuffer();

        return toFile(
            imageBuffer,
            `${path.parse(imagePath).name || "upload"}.png`,
            { type: "image/png" }
        );
    }

    async generateSticker({ imagePaths, prompt, size }) {
        if (!process.env.OPENAI_API_KEY) {
            const error = new Error("OPENAI_API_KEY nao configurada.");
            error.code = "OPENAI_CONFIG_ERROR";
            error.status = 500;
            throw error;
        }

        try {
            const normalizedPaths = Array.isArray(imagePaths)
                ? imagePaths.filter(Boolean)
                : [imagePaths].filter(Boolean);

            if (!normalizedPaths.length) {
                const error = new Error("Nenhuma imagem valida enviada para a OpenAI.");
                error.code = "OPENAI_MISSING_IMAGE";
                error.status = 400;
                throw error;
            }

            const imageFiles = await Promise.all(
                normalizedPaths.map((imagePath) => this.buildUploadFile(imagePath))
            );

            const response = await this.client.images.edit({
                model: this.model,
                image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
                prompt,
                size: size || this.size
            });

            const generatedImage = response?.data?.[0]?.b64_json;

            if (!generatedImage) {
                const error = new Error("A OpenAI nao retornou imagem gerada.");
                error.code = "OPENAI_EMPTY_IMAGE";
                error.status = 502;
                throw error;
            }

            return generatedImage;
        } catch (err) {
            if (err.code === "OPENAI_EMPTY_IMAGE" || err.code === "OPENAI_MISSING_IMAGE") {
                throw err;
            }

            const error = new Error("Falha ao gerar figurinha na OpenAI.");
            error.code = "OPENAI_ERROR";
            error.status = 502;
            error.details = err?.message;
            throw error;
        }
    }
}

module.exports = new OpenAIService();
