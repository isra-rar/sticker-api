const sharp = require("sharp");

class WatermarkService {
    constructor() {
        this.defaultText = process.env.WATERMARK_TEXT || "PREVIEW";
        this.defaultOpacity = Number(process.env.WATERMARK_OPACITY || 0.22);
        this.defaultDirection = this.normalizeDirection(process.env.WATERMARK_DIRECTION);
    }

    normalizeDirection(direction) {
        const normalized = String(direction || "").trim().toLowerCase();
        if (normalized === "vertical") {
            return "vertical";
        }

        return "horizontal";
    }

    async createPreview({ inputPath, outputPath, text }) {
        try {
            const image = sharp(inputPath);
            const metadata = await image.metadata();
            const width = metadata.width || 1024;
            const height = metadata.height || 1024;

            const overlay = this.buildPatternSvg({
                width,
                height,
                text: text || this.defaultText,
                opacity: this.defaultOpacity,
                direction: this.defaultDirection
            });

            await image
                .composite([{ input: Buffer.from(overlay), blend: "over" }])
                .png()
                .toFile(outputPath);

            return outputPath;
        } catch (err) {
            const error = new Error("Falha ao criar preview com marca d'agua.");
            error.code = "WATERMARK_ERROR";
            error.status = 500;
            error.details = err?.message;
            throw error;
        }
    }

        buildPatternSvg({ width, height, text, opacity, direction }) {
        const safeText = String(text).replace(/[<>&"']/g, "");
                const fontSize = Math.max(Math.floor(Math.min(width, height) * 0.09), 34);
                const spacingX = Math.max(Math.floor(fontSize * 3.6), 120);
                const spacingY = Math.max(Math.floor(fontSize * 2.1), 80);
                const strokeOpacity = Math.max(opacity - 0.08, 0.08);
                const items = [];

                if (direction === "vertical") {
                        for (let x = fontSize; x <= width + spacingX; x += spacingX) {
                                for (let y = -spacingY; y <= height + spacingY; y += spacingY) {
                                        items.push(`<text
            x="${x}"
            y="${y}"
            text-anchor="middle"
            transform="rotate(-90 ${x} ${y})"
            fill="rgba(255,255,255,${opacity})"
            stroke="rgba(0,0,0,${strokeOpacity})"
            stroke-width="2"
            font-size="${fontSize}"
            font-family="Arial, sans-serif"
            font-weight="700"
            letter-spacing="4"
        >${safeText}</text>`);
                                }
                        }
                } else {
                        for (let y = fontSize; y <= height + spacingY; y += spacingY) {
                                for (let x = -spacingX; x <= width + spacingX; x += spacingX) {
                                        items.push(`<text
            x="${x}"
            y="${y}"
            text-anchor="middle"
            fill="rgba(255,255,255,${opacity})"
            stroke="rgba(0,0,0,${strokeOpacity})"
            stroke-width="2"
            font-size="${fontSize}"
            font-family="Arial, sans-serif"
            font-weight="700"
            letter-spacing="4"
        >${safeText}</text>`);
                                }
                        }
                }

        return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${items.join("\n")}
</svg>`;
    }
}

module.exports = new WatermarkService();
