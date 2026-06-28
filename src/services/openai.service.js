const fs = require("fs");
const OpenAI = require("openai");

class OpenAIService {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
        this.size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
    }

    async generateSticker({ imagePath, prompt }) {
        if (!process.env.OPENAI_API_KEY) {
            const error = new Error("OPENAI_API_KEY nao configurada.");
            error.code = "OPENAI_CONFIG_ERROR";
            error.status = 500;
            throw error;
        }

        try {
            const response = await this.client.images.edit({
                model: this.model,
                image: fs.createReadStream(imagePath),
                prompt,
                size: this.size
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
            if (err.code === "OPENAI_EMPTY_IMAGE") {
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
