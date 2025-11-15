# DataCert Architecture Notes

## Core Principles
- Every dataset action (ingest, verify, access, resell) emits an immutable record on Sui.
- Walrus stores the canonical dataset blob; Seal enforces paid/permissioned access.
- Off-chain components (backend, workers) never hold plaintext encryption keys once stored.

## Components
1. **Frontend (React)**  
   - Dataset wizard collects metadata, consent proofs, license references, and C2PA manifests.  
   - Integrates Sui dApp Kit for wallet signatures and WAL staking UX.  
   - Visualizes provenance timelines via Recharts timeline + map overlays.

2. **Backend (Node/Express)**  
   - Upload proxy → streams files to Walrus CLI/SDK, returns `blob_id`, `integrity_root`, and `expiry`.  
   - Provenance service → derives SHA-256 + Poseidon hashes, writes receipts to Postgres (or in-memory for demo).  
   - Contract client → calls Sui Move endpoints (mint certificate, update policy, log dispute outcome).  
   - Seal service → configures policy templates for token-gated or stake-gated downloads.  
   - Webhook handler → receives Nautilus alerts for suspicious media, flags dataset for review.

3. **Contracts (Move)**  
   - `dataset_certificate.move` defines `DatasetCertificate` object with metadata, Walrus blob reference, and compliance flags.  
   - `claim_registry.move` stores tamper-evident audit claims from verifiers or buyers.  
   - `policy_vault.move` escrows WAL deposits and enforces revocation rules.

## Data Flow
```
User → Frontend (metadata + file) → Backend (hash + Walrus upload)
     → Walrus returns blob/proof → Backend submits to Move contract
     → Contract emits certificate ID → Frontend shows minted NFT
     → Seal policy configured → Buyers request access → Backend verifies token/stake → stream via Walrus read
```

## Security Considerations
- **Hash commitments**: Both SHA-256 and Poseidon commitments stored to support ZK-friendly proofs.
- **Role separation**: In demo, we simulate dataset creators, auditors, and buyers via distinct wallet addresses.
- **Audit logging**: Every API mutation persists to append-only JSONL (see `backend/logs/provenance.log`).
- **Secrets**: `.env` files hold WALRUS_API_KEY, SUI_FULLNODE, and SEAL_KEY. Never commit them.

## Demo Setup
1. Seed backend with two sample datasets (public + premium) using `npm run seed`.
2. Compile Move contracts on Sui Devnet; note package ID for frontend env var.
3. Use provided mock Walrus CLI script (`scripts/mockWalrus.ts`) when offline.
