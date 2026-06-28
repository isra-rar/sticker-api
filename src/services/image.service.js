const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

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

    buildOutputFilePath(fileName) {
        return path.join(this.outputDir, fileName);
    }
}

module.exports = new ImageService();
