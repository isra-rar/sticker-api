const fs = require("fs/promises");
const path = require("path");

class PromptService {
    constructor() {
        this.promptsDir = path.resolve(__dirname, "..", "..", "prompts", "stickers");
    }

    getBasePromptFileName() {
        return "base.txt";
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
        return `${this.getBasePromptFileName()} + ${this.getPromptFileName(stickerType)}`;
    }

    getPromptFileName(stickerType) {
        const normalizedType = this.sanitizeStickerType(stickerType);

        if (normalizedType === "normal") {
            return "normal.txt";
        }

        if (["gold", "silver", "bronze"].includes(normalizedType)) {
            return "gold.txt";
        }

        if (["legend_gold", "legend_silver", "legend_bronze", "legend_purple"].includes(normalizedType)) {
            return "legend.txt";
        }

        const error = new Error("Prompt nao encontrado para o tipo informado.");
        error.code = "PROMPT_NOT_FOUND";
        error.status = 404;
        throw error;
    }

    async loadPrompt(stickerType) {
        const promptFilePath = path.join(this.promptsDir, this.getPromptFileName(stickerType));
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

    async loadBasePrompt() {
        const promptFilePath = path.join(this.promptsDir, this.getBasePromptFileName());
        const resolvedPath = path.resolve(promptFilePath);

        if (!resolvedPath.startsWith(this.promptsDir + path.sep)) {
            const error = new Error("Prompt base invalido.");
            error.code = "PROMPT_NOT_FOUND";
            error.status = 404;
            throw error;
        }

        try {
            await fs.access(resolvedPath);
        } catch (accessError) {
            const error = new Error("Prompt base nao encontrado.");
            error.code = "PROMPT_NOT_FOUND";
            error.status = 404;
            throw error;
        }

        return fs.readFile(resolvedPath, "utf-8");
    }

    getLegendMetadata(stickerType) {
        const normalizedType = this.sanitizeStickerType(stickerType);

        const metadataByType = {
            legend_bronze: {
                legend_category: "Bronze",
                legend_color: "bronze",
                legend_effect: "efeitos discretos"
            },
            legend_silver: {
                legend_category: "Silver",
                legend_color: "prata",
                legend_effect: "efeitos moderados"
            },
            legend_gold: {
                legend_category: "Gold",
                legend_color: "ouro",
                legend_effect: "efeitos intensos"
            },
            legend_purple: {
                legend_category: "Purple",
                legend_color: "roxo",
                legend_effect: "efeitos luminosos"
            }
        };

        return metadataByType[normalizedType] || {};
    }

    enrichPromptData(stickerType, data = {}) {
        return {
            ...this.getLegendMetadata(stickerType),
            ...data
        };
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
        const [basePromptText, stylePromptText] = await Promise.all([
            this.loadBasePrompt(),
            this.loadPrompt(stickerType)
        ]);
        const promptData = this.enrichPromptData(stickerType, data);

        return this.replacePlaceholders(
            `${basePromptText.trim()}\n\n--------------------------------------------------\n\n${stylePromptText.trim()}`,
            promptData
        );
    }
}

module.exports = new PromptService();
