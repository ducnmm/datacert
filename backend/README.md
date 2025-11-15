# DataCert Backend (Express + TypeScript)

## Features
- Walrus upload proxy that returns session IDs + integrity metadata.
- Dataset registry that mints mock Sui certificates and activates Seal policies.
- Access control simulator for stake/token gated datasets.
- In-memory provenance store with audit logs at `logs/provenance.log`.

## Commands
```bash
npm install          # install deps
npm run dev          # run with hot reload on http://localhost:4000
npm run build        # emit dist/ via tsc
npm run start        # run compiled build
npm run seed         # seed demo dataset
```

## Environment
See `.env.example` for Walrus/Sui configuration placeholders. Values default to devnet/testnet if not provided.

Key variables:
- `APP_BASE_URL`: external URL of this backend (used for webhook callbacks).
- `NAUTILUS_API_BASE_URL` / `NAUTILUS_API_KEY`: credentials for Nautilus verification API.
- `NAUTILUS_WEBHOOK_URL`: override callback target (defaults to `${APP_BASE_URL}/api/nautilus/webhook`).

## API Highlights
- `POST /api/datasets/upload` → `{ sessionId, walrus }`
- `POST /api/datasets/register` → Dataset record (creates certificate)
- `GET /api/datasets` / `GET /api/datasets/:id`
- `POST /api/datasets/:id/claims` → add dispute/audit claims
- `POST /api/datasets/:id/access` → checks policy + returns Walrus download URL stub
