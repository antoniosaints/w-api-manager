# W-API Atendimento

Primeira versao de um sistema local de atendimento para W-API com React, Node.js, SQLite e Socket.IO.

## Recursos

- Recebe mensagens em tempo real via webhook (`/webhooks/wapi/received`).
- Salva contatos, mensagens e eventos no SQLite em `data/app.sqlite`.
- Envia e responde mensagens de texto usando `POST /v1/message/send-text`.
- Consulta status da instancia e QR Code.
- Configura webhooks basicos da W-API usando endpoints da colecao Postman.

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`.

Para receber webhooks reais, publique o servidor local com uma URL HTTPS acessivel externamente, por exemplo via ngrok ou Cloudflare Tunnel, e coloque a URL base em `WEBHOOK_PUBLIC_URL` ou na tela de Configuracoes. Exemplo: `https://seu-tunel.ngrok-free.app`.

## Endpoints W-API usados

- `GET /v1/instance/status-instance`
- `GET /v1/instance/qr-code`
- `POST /v1/message/send-text`
- `PUT /v1/webhook/update-webhook-received`
- `PUT /v1/webhook/update-webhook-delivery`
- `PUT /v1/webhook/update-webhook-message-status`
- `PUT /v1/webhook/update-webhook-chat-presence`
- `PUT /v1/webhook/update-webhook-connected`
- `PUT /v1/webhook/update-webhook-disconnected`
