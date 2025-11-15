# DataCert Demo Script (10 phút)

## 1. Problem Framing (1 phút)
- Slide: lawsuits + bias stats (trích từ `ai-data-provenance-tracker-spec.md`).
- Key line: “Không ai chứng minh được training data nguồn gốc.”

## 2. Architecture Snapshot (1 phút)
- Show `docs/architecture.md` diagram.
- Call out Walrus storage, Seal gating, Sui certificates, backend API, React dashboard.

## 3. Live Flow (6 phút)
1. **Upload Wizard**
   - In frontend, chọn file sample (e.g., `sample-dataset.csv`).
   - Chọn policy `stake-gated`, min 25 WAL.
   - Hit “Mint dataset certificate”.
   - Narrate CLI logs from backend or show `backend/logs/provenance.log`.
2. **View Certificate**
   - Dataset appears in Registry grid.
   - Click card → show timeline (Walrus upload + Sui mint + Seal policy).
   - Highlight SHA-256 vs Poseidon hash for ZK friendliness.
3. **Raise Claim**
   - Use claims form → note severity + evidence URL.
   - Explain that backend pushes to Move `file_claim`.
4. **Request Access**
   - Fill purpose + WAL stake.
   - Show returned Walrus download URL + Sui tx hash (`record_access` event).

## 4. Competitive Edge (1 phút)
- Speed: full flow < 2 minutes.
- Compliance: immutable audit log + access receipts on-chain.
- Extensibility: plug in C2PA manifests or HF dataset cards later.

## 5. Q&A Prep
- `npm run seed` to preload dataset in case of demo hiccups.
- Keep `sui explorer` tab ready to show `CertificateMinted` / `ClaimRaised` events.
