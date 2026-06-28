const fs = require("fs/promises");
const path = require("path");

class PromptService {
    constructor() {
        this.promptsDir = path.resolve(__dirname, "..", "..", "prompts");
    }

    sanitizeStickerType(stickerType) {
        const normalizedType = String(stickerType || "").trim().toLowerCase();

        if (!normalizedType || !/^[a-z0-9_]+$/.test(normalizedType)) {
            const error = new Error("Tipo de figurinha invalido.");
            error.code = "INVALID_STICKER_TYPE";
            error.status = 400;
            throw error;
        }

        return normalizedType;
    }

    getPromptName(stickerType) {
        return `${this.sanitizeStickerType(stickerType)}.txt`;
    }

    async loadPrompt(stickerType) {
        const normalizedType = this.sanitizeStickerType(stickerType);
        const promptFilePath = path.join(this.promptsDir, `${normalizedType}.txt`);
        const resolvedPath = path.resolve(promptFilePath);

        if (!resolvedPath.startsWith(this.promptsDir + path.sep)) {
            const error = new Error("Tipo de figurinha invalido.");
            error.code = "INVALID_STICKER_TYPE";
            error.status = 400;
            throw error;
        }

        try {
            await fs.access(resolvedPath);
        } catch (accessError) {
            const error = new Error("Prompt nao encontrado para o tipo informado.");
            error.code = "PROMPT_NOT_FOUND";
            error.status = 404;
            throw error;
        }

        return fs.readFile(resolvedPath, "utf-8");
    }

    replacePlaceholders(promptText, data = {}) {
        return promptText.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
            if (data[key] === undefined || data[key] === null) {
                return "";
            }

            return String(data[key]).trim();
        });
    }

    async buildPrompt(stickerType, data = {}) {
        const promptText = await this.loadPrompt(stickerType);
        return this.replacePlaceholders(promptText, data);
    }
}

module.exports = new PromptService();
