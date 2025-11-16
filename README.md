# Datacert - AI Dataset Trust Marketplace

**Walrus Haulout Hackathon 2025** (Provably Authentic Track)

Decentralized marketplace for AI training datasets with trust verification powered by Sui blockchain, Walrus storage, and Nautilus TEE.

## Reason
Recently, several major lawsuits — including the Munich court ruling that ChatGPT violated copyright by training on song lyrics — have shown how serious the copyright problem is for AI training data. This makes it essential to have a marketplace where people can legally buy and sell datasets with transparent usage rights.

Our project solves this by storing purchase and access history on-chain, so any future dispute can be resolved by proving legitimate access through the blockchain record.

In addition to normal backend/on-chain checks, we also added a Nautilus-based (mock AWS Nitro) verification layer to compute trust scores securely and tamper-resistantly.

## Key Innovation: AI Trust Oracle

Trust Oracle running in AWS Nitro enclaves (Nautilus) calculates tamper-proof trust scores (0-100) based on:

- **Provenance (25 pts)**: Data lineage, creator reputation
- **Integrity (25 pts)**: Cryptographic verification via Walrus
- **Audit (25 pts)**: Independent claims, vulnerability reports
- **Usage (25 pts)**: Access patterns, downloads

All computations in TEE with Ed25519 signatures for cryptographic verification.

## Architecture

```
Frontend (React) ──▶ Backend (Node) ──▶ Walrus Storage
                          │
                          ▼
                   Sui Blockchain ◀── Nautilus TEE
                          │
                          ▼
                    PostgreSQL
```

## Cost & Access

> **💡 No Wallet Required**: For easy testing and observation, all Walrus storage and Sui gas costs are currently **sponsored via Walrus CLI**. Users can upload and interact with datasets without connecting a wallet or paying any fees.

## Live Deployment

**Frontend**: [https://frontend-ten-azure-64.vercel.app/](https://frontend-ten-azure-64.vercel.app/) (Vercel)
**Backend API**: [https://walrus-haulout-backend-long-bird-9060.fly.dev](https://walrus-haulout-backend-long-bird-9060.fly.dev) (Fly.io)
**Nautilus TEE** (Mock): [https://walrus-haulout-nautilus.fly.dev](https://walrus-haulout-nautilus.fly.dev) (Fly.io)

## Features

**Creators**: Upload datasets, mint NFT certificates, configure access policies, track metrics
**Consumers**: Browse with trust scores, verify integrity, stake-gated access, audit trail
**Auditors**: File claims (on-chain + off-chain), view trust history, inspect proofs

## Quick Start

### Prerequisites
- Node.js 18+, PostgreSQL 14+
- Sui CLI, Walrus CLI

### Setup

```bash
# Install
cd backend && npm install
cd ../frontend && npm install

# Configure .env files (see backend/.env.example, frontend/.env.example)

# Database
cd backend
npx prisma migrate deploy
npx prisma generate

# Start services (4 terminals)
cd nautilus && ./run-local.sh           # Terminal 1: TEE on :8080
cd backend && npm run dev                # Terminal 2: API on :3003
cd frontend && npm run dev               # Terminal 3: UI on :5173
cd backend && npm run indexer            # Terminal 4: Event sync
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
walrus_haulout/
├── backend/          # Express API, Prisma ORM, event indexer
│   ├── src/
│   │   ├── lib/      # suiClient, walrusClient, nautilusClient
│   │   ├── services/ # datasetService, prismaService, indexer
│   │   └── routes/   # datasets, trust, claims
│   └── prisma/schema.prisma
├── frontend/         # React + TypeScript + Vite
│   └── src/pages/    # HomePage, DatasetsPage, DatasetDetailPage
├── nautilus/         # AWS Nitro enclave
│   ├── move/ai-trust-oracle/  # Move contract
│   └── server/src/main.rs     # Rust enclave
└── README.md
```

## Technology Stack

**Blockchain**: Sui, Walrus, @mysten/dapp-kit
**Backend**: Node.js, Express, TypeScript, Prisma, PostgreSQL
**Frontend**: React 18, Vite, CSS Modules
**TEE**: Nautilus, Rust, Ed25519 signatures

## Trust Score Calculation

```
Trust Score = Provenance + Integrity + Audit + Usage

- Provenance (0-25) = 15 (owner) + 10 (description)
- Integrity (0-25) = 10 (walrus) + 10 (sha256) + 5 (poseidon)
- Audit (0-25) = MAX(0, 25 - critical*10 - medium*5 - low*2)
- Usage (0-25) = MIN(25, downloads * 2.5)
```

**Example**: Sample dataset with owner, description, all hashes, 0 claims, 4 downloads = **85/100**

## Smart Contracts (Sui Testnet)

**Addresses**:
- Package: `0x58fc8a3d9978fcf9f3ce4f64c8cc7ee51a68c2d2c3a7dd087b4e7a2aec7a9d45`
- Access Registry: `0x84ce31ca3501843aa42fdb65d47288c193ea33b068fb88cb6bd11c113bd2d750`
- Claim Registry: `0xce15a994eab487c5808318d57e92ac58bd856530c398f47751d14ffdc0e57e75`

**Key Functions**:
- `mint_certificate()` - Create dataset NFT
- `grant_access()` - Stake-gated access control
- `file_claim()` - Submit audit claims (severity: 0=info, 1=warning, 2=critical)
- `update_trust_score()` - Update with TEE proof signature

**Events**: `AccessGranted`, `ClaimRaised`, `TrustScoreUpdated`

## API Endpoints

```
GET  /api/datasets              # List all with trust scores
GET  /api/datasets/:id          # Detail + trust breakdown
POST /api/datasets              # Upload to Walrus + mint NFT
POST /api/datasets/:id/access   # Request access (stake if required)

GET  /api/trust/:id             # Current trust score + signature
GET  /api/trust/:id/history     # Historical changes

POST /api/claims                # File audit claim
GET  /api/datasets/:id/claims   # Get all claims
```

## On-Chain Objects

1. **Dataset Certificate (NFT)** - Unique per dataset, contains metadata, integrity hash, trust score
2. **Access Registry** (`0x84ce31...`) - All access grants, transparent revenue tracking
3. **Claim Registry** (`0xce15a9...`) - Immutable audit trail

## Development

```bash
# Tests
cd backend && npm test
cd nautilus/move/ai-trust-oracle && sui move test

# Build
cd backend && npm run build
cd frontend && npm run build
cd nautilus/move/ai-trust-oracle && sui move build

# Database
npx prisma migrate dev --name migration_name
```

## Roadmap

**Phase 1: Hackathon MVP** ✓
- Dataset upload to Walrus
- Smart contracts on Sui Testnet
- Trust score with Nautilus TEE
- Frontend (browse, detail, claims)
- Event indexer
- On-chain object links

## Security Considerations

### Cryptographic Guarantees
- Trust scores signed by Nautilus TEE with Ed25519
- Walrus integrity roots for tamper-proof storage
- SHA-256 and Poseidon hashes for multi-layer integrity
- BCS serialization for Move compatibility

### Access Control
- Stake-gated datasets require SUI deposits
- Smart contract enforces minimums
- On-chain access logging

### Known Limitations (PoC Status)
- Backend uses single keypair (should be multi-sig or custodial wallet)
- No rate limiting on API endpoints
- Nautilus enclave runs locally (should be AWS Nitro production)
- No automated claim verification (relies on human auditors)
- Event indexer doesn't handle chain reorgs

## Acknowledgments

**Walrus Team**, **Sui Foundation**, **Nautilus/Automata**, **Walrus Haulout Hackathon** organizers

---

Built with ❤️ for **Walrus Haulout Hackathon 2025**
