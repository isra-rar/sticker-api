const { v4: uuidv4 } = require("uuid");
const fs = require("fs/promises");
const OrderRepository = require("../repositories/order.repository");
const PaymentRepository = require("../repositories/payment.repository");
const PromptService = require("./prompt.service");
const OpenAIService = require("./openai.service");
const TemplateService = require("./template.service");
const ImageService = require("./image.service");
const WatermarkService = require("./watermark.service");
const CacheService = require("./cache.service");

class OrderService {
    constructor() {
        this.downloadCacheTtlMs = Number(process.env.ORDER_CACHE_TTL_MS || 30000);
    }

    isPaymentFlowEnabled() {
        return process.env.PAYMENT_FLOW_ENABLED === "true";
    }

    getRequiredImageFields() {
        return ["photo"];
    }

    validateRequiredImages(files = {}) {
        const missingFields = this.getRequiredImageFields()
            .filter((fieldName) => !files[fieldName]?.path);

        if (!missingFields.length) {
            return;
        }

        const error = new Error(`Campos de imagem obrigatorios ausentes: ${missingFields.join(", ")}.`);
        error.code = "MISSING_IMAGE";
        error.status = 400;
        throw error;
    }

    async cleanupUploadedFiles(files = {}) {
        await Promise.all(
            Object.values(files)
                .filter((file) => file?.path)
                .map((file) => fs.unlink(file.path).catch(() => null))
        );
    }

    getDownloadCacheKey(orderId) {
        return `order-download:${orderId}`;
    }

    invalidateDownloadCache(orderId) {
        CacheService.del(this.getDownloadCacheKey(orderId));
    }

    async createAndGenerate({ files = {}, payload }) {
        const paymentFlowEnabled = this.isPaymentFlowEnabled();
        const stickerType = payload?.stickerType;
        if (!stickerType) {
            const error = new Error("Campo stickerType e obrigatorio.");
            error.code = "INVALID_STICKER_TYPE";
            error.status = 400;
            throw error;
        }

        this.validateRequiredImages(files);
        const templateAssets = await TemplateService.resolveTemplateAssets(stickerType, payload);
        const { templatePath, maskPath } = templateAssets;
        const openAiImageSize = await TemplateService.getOpenAiImageSize(templatePath);

        let amount = null;
        let provider = null;
        let currency = null;

        if (paymentFlowEnabled) {
            amount = Number(payload?.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                const error = new Error("Campo amount deve ser maior que zero.");
                error.code = "INVALID_AMOUNT";
                error.status = 400;
                throw error;
            }

            provider = String(payload?.provider || "").trim();
            if (!provider) {
                const error = new Error("Campo provider e obrigatorio.");
                error.code = "INVALID_PROVIDER";
                error.status = 400;
                throw error;
            }

            currency = String(payload?.currency || "BRL").trim().toUpperCase();
            if (!/^[A-Z]{3}$/.test(currency)) {
                const error = new Error("Campo currency deve seguir o padrao ISO (ex: BRL).");
                error.code = "INVALID_CURRENCY";
                error.status = 400;
                throw error;
            }
        }

        const promptName = PromptService.getPromptName(stickerType);

        let order = await OrderRepository.create({
            status: "PENDING",
            stickerType,
            promptName,
            playerName: payload?.name,
            country: payload?.country,
            number: payload?.number,
            position: payload?.position
        });

        let payment = null;
        if (paymentFlowEnabled) {
            payment = await PaymentRepository.create({
                gatewayPaymentId: payload?.gatewayPaymentId || null,
                orderId: order.id,
                status: "PENDING",
                amount,
                currency,
                provider,
                providerPayload: payload?.providerPayload ? payload.providerPayload : null
            });

            order = await OrderRepository.updateById(order.id, {
                paymentId: payment.id,
                status: "GENERATING"
            });
        } else {
            order = await OrderRepository.updateById(order.id, {
                status: "GENERATING"
            });
        }

        try {
            const prompt = await PromptService.buildPrompt(stickerType, payload);
            const generatedImageBase64 = await OpenAIService.generateSticker({
                imagePaths: [templatePath, files.photo.path],
                prompt,
                size: openAiImageSize
            });

            const baseFileName = `${Date.now()}-${uuidv4()}`;
            const originalFileName = `${baseFileName}-original.png`;
            const previewFileName = `${baseFileName}-preview.png`;
            const originalPath = ImageService.buildOutputFilePath(originalFileName);
            const previewPath = ImageService.buildOutputFilePath(previewFileName);

            await ImageService.saveBase64ImageUsingTemplate({
                base64Image: generatedImageBase64,
                templatePath,
                templateMaskPath: maskPath,
                outputPath: originalPath
            });
            await WatermarkService.createPreview({
                inputPath: originalPath,
                outputPath: previewPath,
                text: process.env.WATERMARK_TEXT || "PREVIEW"
            });

            order = await OrderRepository.updateById(order.id, {
                status: paymentFlowEnabled ? "WAITING_PAYMENT" : "DELIVERED",
                imageOriginalPath: `output/${originalFileName}`,
                imagePreviewPath: `output/${previewFileName}`
            });

            this.invalidateDownloadCache(order.id);

            return { order, payment };
        } catch (err) {
            await OrderRepository.updateById(order.id, { status: "FAILED" });
            throw err;
        } finally {
            await this.cleanupUploadedFiles(files);
        }
    }

    async getDownloadTarget(orderId) {
        const cacheKey = this.getDownloadCacheKey(orderId);
        const cached = CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        const order = await OrderRepository.findById(orderId);

        if (!order) {
            const error = new Error("Pedido nao encontrado.");
            error.code = "ORDER_NOT_FOUND";
            error.status = 404;
            throw error;
        }

        const imagePath = order.status === "PAID" || order.status === "DELIVERED"
            ? order.imageOriginalPath
            : order.imagePreviewPath;

        if (!imagePath) {
            const error = new Error("Imagem ainda nao disponivel para este pedido.");
            error.code = "ORDER_IMAGE_NOT_READY";
            error.status = 409;
            throw error;
        }

        if (order.status === "PAID") {
            await OrderRepository.updateById(order.id, { status: "DELIVERED" });
            order.status = "DELIVERED";
        }

        const result = {
            orderId: order.id,
            status: order.status,
            imagePath
        };

        CacheService.set(cacheKey, result, this.downloadCacheTtlMs);

        return result;
    }
}

module.exports = new OrderService();
