const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");

class ImageService {
    constructor() {
        this.outputDir = path.resolve(__dirname, "..", "..", "output");
    }

    async saveBase64Image(base64Image, extension = "png") {
        const fileName = `${Date.now()}-${uuidv4()}.${extension}`;
        const outputPath = path.join(this.outputDir, fileName);

        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(outputPath, Buffer.from(base64Image, "base64"));

            return {
                fileName,
                outputPath
            };
        } catch (err) {
            const error = new Error("Erro ao salvar a imagem gerada.");
            error.code = "IMAGE_SAVE_ERROR";
            error.status = 500;
            error.details = err?.message;
            throw error;
        }
    }

    async saveBase64ImageToPath(base64Image, outputPath) {
        try {
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, Buffer.from(base64Image, "base64"));

            return outputPath;
        } catch (err) {
            const error = new Error("Erro ao salvar a imagem gerada.");
            error.code = "IMAGE_SAVE_ERROR";
            error.status = 500;
            error.details = err?.message;
            throw error;
        }
    }

    async saveBase64ImageUsingTemplate({ base64Image, templatePath, templateMaskPath, outputPath }) {
        try {
            const templateMetadata = await sharp(templatePath).metadata();
            const width = templateMetadata.width;
            const height = templateMetadata.height;

            if (!width || !height) {
                const error = new Error("Template de figurinha invalido.");
                error.code = "TEMPLATE_INVALID";
                error.status = 500;
                throw error;
            }

            const generatedBuffer = Buffer.from(base64Image, "base64");
            const resizedGenerated = await sharp(generatedBuffer)
                .resize({
                    width,
                    height,
                    fit: "cover",
                    position: "center"
                })
                .png()
                .toBuffer();

            await fs.mkdir(path.dirname(outputPath), { recursive: true });

            if (templateMaskPath) {
                const maskBuffer = await sharp(templateMaskPath)
                    .resize({
                        width,
                        height,
                        fit: "fill"
                    })
                    .greyscale()
                    .png()
                    .toBuffer();

                const maskedGenerated = await sharp(resizedGenerated)
                    .removeAlpha()
                    .joinChannel(maskBuffer)
                    .png()
                    .toBuffer();

                await sharp(templatePath)
                    .png()
                    .composite([{ input: maskedGenerated, blend: "over" }])
                    .png()
                    .toFile(outputPath);

                return outputPath;
            }

            if (templateMetadata.hasAlpha) {
                const templateOverlay = await sharp(templatePath).png().toBuffer();
                await sharp(resizedGenerated)
                    .composite([{ input: templateOverlay, blend: "over" }])
                    .png()
                    .toFile(outputPath);
            } else {
                await sharp(resizedGenerated).png().toFile(outputPath);
            }

            return outputPath;
        } catch (err) {
            const error = new Error("Erro ao ajustar imagem para o template.");
            error.code = "IMAGE_TEMPLATE_ALIGN_ERROR";
            error.status = 500;
            error.details = err?.message;
            throw error;
        }
    }

    buildOutputFilePath(fileName) {
        return path.join(this.outputDir, fileName);
    }
}

module.exports = new ImageService();
