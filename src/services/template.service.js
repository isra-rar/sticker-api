const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const PromptService = require("./prompt.service");

class TemplateService {
    constructor() {
        this.templatesDir = path.resolve(__dirname, "..", "..", "prompts", "stickers", "figurinhas");
        this.supportedExtensions = [".png", ".webp", ".jpg", ".jpeg"];
    }

    normalizeToken(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    getCountryToken(country) {
        const normalizedCountry = this.normalizeToken(country);
        const aliases = {
            brasil: "brasil",
            brazil: "brasil",
            argentina: "argentina",
            franca: "franca",
            france: "franca",
            espanha: "espanha",
            spain: "espanha",
            portugal: "portugal"
        };

        return aliases[normalizedCountry] || normalizedCountry;
    }

    getTemplateCategory(stickerType) {
        const normalizedType = PromptService.sanitizeStickerType(stickerType);

        if (normalizedType === "normal") {
            return "normal";
        }

        if (["gold", "silver", "bronze"].includes(normalizedType)) {
            return "gold";
        }

        if (normalizedType.startsWith("legend_")) {
            return "legend";
        }

        return normalizedType;
    }

    isGoalkeeper(position) {
        const normalizedPosition = this.normalizeToken(position);

        return ["goleiro", "goalkeeper", "keeper", "gk"].includes(normalizedPosition);
    }

    getTemplateFileNames(stickerType, data = {}) {
        const normalizedType = PromptService.sanitizeStickerType(stickerType);

        if (normalizedType === "normal") {
            const country = this.getCountryToken(data.country) || "brasil";

            if (this.isGoalkeeper(data.position)) {
                return [`normal/comum_goleiro_${country}`];
            }

            return [`normal/comum_${country}`];
        }

        if (["gold", "silver", "bronze"].includes(normalizedType)) {
            const country = this.getCountryToken(data.country) || "brasil";
            return [`gold/dourada_${country}`];
        }

        if (normalizedType.startsWith("legend_")) {
            const legendColor = normalizedType.replace("legend_", "");
            const legendAlias = {
                bronze: "legend_bronze",
                silver: "legend_silver",
                gold: "legend_gold",
                purple: "legend_purple"
            };

            return [`legend/${legendAlias[legendColor] || normalizedType}`];
        }

        return [`${this.getTemplateCategory(normalizedType)}/${normalizedType}`];
    }

    getCandidateTemplatePaths(stickerType, data = {}) {
        const templateBaseNames = this.getTemplateFileNames(stickerType, data);

        return templateBaseNames.flatMap((templateBaseName) => (
            this.supportedExtensions.map((extension) => (
                path.join(this.templatesDir, `${templateBaseName}${extension}`)
            ))
        ));
    }

    getCandidateMaskPaths(templatePath) {
        const templateDir = path.dirname(templatePath);
        const templateName = path.parse(templatePath).name;

        return this.supportedExtensions.flatMap((extension) => ([
            path.join(templateDir, `${templateName}_mask${extension}`),
            path.join(templateDir, `${templateName}.mask${extension}`),
            path.join(templateDir, "masks", `${templateName}_mask${extension}`),
            path.join(templateDir, "masks", `${templateName}${extension}`)
        ]));
    }

    async resolveTemplateMaskPath(templatePath) {
        const candidatePaths = this.getCandidateMaskPaths(templatePath);

        for (const candidatePath of candidatePaths) {
            try {
                await fs.access(candidatePath);
                return candidatePath;
            } catch (err) {
                continue;
            }
        }

        return null;
    }

    async resolveTemplatePath(stickerType, data = {}) {
        const candidatePaths = this.getCandidateTemplatePaths(stickerType, data);

        for (const candidatePath of candidatePaths) {
            try {
                await fs.access(candidatePath);
                return candidatePath;
            } catch (err) {
                continue;
            }
        }

        const error = new Error(`Template nao encontrado para o tipo ${stickerType}. Adicione um arquivo em prompts/stickers/figurinhas com um destes nomes: ${candidatePaths.map((candidatePath) => path.basename(candidatePath)).join(", ")}.`);
        error.code = "TEMPLATE_NOT_FOUND";
        error.status = 404;
        throw error;
    }

    async resolveTemplateAssets(stickerType, data = {}) {
        const templatePath = await this.resolveTemplatePath(stickerType, data);
        const maskPath = await this.resolveTemplateMaskPath(templatePath);

        return {
            templatePath,
            maskPath
        };
    }

    async getTemplateMetadata(templatePath) {
        return sharp(templatePath).metadata();
    }

    async getOpenAiImageSize(templatePath) {
        const metadata = await this.getTemplateMetadata(templatePath);
        const width = Number(metadata?.width) || 0;
        const height = Number(metadata?.height) || 0;

        if (height > width) {
            return "1024x1536";
        }

        if (width > height) {
            return "1536x1024";
        }

        return "1024x1024";
    }
}

module.exports = new TemplateService();