const sharp = require("sharp");

class WatermarkService {
    constructor() {
        this.defaultText = process.env.WATERMARK_TEXT || "PREVIEW";
        this.defaultOpacity = Number(process.env.WATERMARK_OPACITY || 0.22);
    }

    async createPreview({ inputPath, outputPath, text }) {
        try {
            const image = sharp(inputPath);
            const metadata = await image.metadata();
            const width = metadata.width || 1024;
            const height = metadata.height || 1024;

            const overlay = this.buildDiagonalSvg({
                width,
                height,
                text: text || this.defaultText,
                opacity: this.defaultOpacity
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

    buildDiagonalSvg({ width, height, text, opacity }) {
        const safeText = String(text).replace(/[<>&"']/g, "");

        return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${width / 2} ${height / 2}) rotate(-28)">
    <text
      x="0"
      y="0"
      text-anchor="middle"
      fill="rgba(255,255,255,${opacity})"
      stroke="rgba(0,0,0,${Math.max(opacity - 0.08, 0.08)})"
      stroke-width="2"
      font-size="${Math.max(Math.floor(width * 0.1), 42)}"
      font-family="Arial, sans-serif"
      font-weight="700"
      letter-spacing="5"
    >${safeText}</text>
  </g>
</svg>`;
    }
}

module.exports = new WatermarkService();
