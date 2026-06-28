# Sticker API

## Webhook pronto para configuracao

Quando voce tiver a URL publica da API, registre este endpoint no gateway:

- `POST {PUBLIC_API_URL}/webhooks/payment`

Exemplo com valor atual do `.env`:

- `POST http://localhost:3000/webhooks/payment`

Em ambiente real, troque `PUBLIC_API_URL` para o dominio publico (ex.: https://api.seudominio.com).

## Headers obrigatorios do webhook

- `x-webhook-secret`: deve ser igual a `WEBHOOK_SECRET`
- `x-webhook-timestamp`: epoch em segundos
- `x-webhook-signature`: HMAC SHA256 de `"{timestamp}.{rawBody}"` usando `WEBHOOK_SIGNATURE_SECRET`
- IP de origem deve estar em `WEBHOOK_ALLOWED_IPS`

## Corpo minimo aceito

Precisa conter:

- `status`
- Um identificador: `paymentId` ou `gatewayPaymentId` ou `orderId`

Exemplo:

```json
{
  "status": "APPROVED",
  "gatewayPaymentId": "gw_123456"
}
```

## Resposta de sucesso

A API responde `200` com:

```json
{
  "success": true,
  "message": "Webhook processado com sucesso.",
  "paymentId": "...",
  "paymentStatus": "APPROVED",
  "orderId": "...",
  "orderStatus": "PAID",
  "paidAt": "2026-06-28T17:00:00.000Z"
}
```

## Teste local rapido da assinatura

1. Defina o payload em uma string JSON sem alterar espacos/quebras entre assinatura e envio.
2. Gere assinatura:

```bash
node -e "const crypto=require('crypto'); const ts=Math.floor(Date.now()/1000); const body='{"status":"APPROVED","gatewayPaymentId":"gw_123"}'; const sig=crypto.createHmac('sha256', process.env.WEBHOOK_SIGNATURE_SECRET).update(`${ts}.${body}`).digest('hex'); console.log({ts,sig,body});"
```

3. Envie com os 3 headers (`x-webhook-secret`, `x-webhook-timestamp`, `x-webhook-signature`).

## Checklist quando receber a URL final

- Atualizar `PUBLIC_API_URL`
- Registrar `POST {PUBLIC_API_URL}/webhooks/payment` no gateway
- Configurar IPs reais do gateway em `WEBHOOK_ALLOWED_IPS`
- Confirmar `WEBHOOK_SECRET` e `WEBHOOK_SIGNATURE_SECRET`
- Se houver proxy/reverse proxy, usar `TRUST_PROXY=true`
