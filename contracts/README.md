# DataCert Move Contracts

This package provides the on-chain trust layer for DataCert. It mints dataset certificates, logs gated access, and stores on-chain claims so auditors/judges can reproduce the provenance trail.

## Key Modules
- `dataset_certificate.move`
  - `mint_certificate` – accepts Walrus proofs + metadata, emits `CertificateMinted`, and transfers the `DatasetCertificate` object to the dataset owner.
  - `record_access` – emits `AccessGranted` when the backend records a successful Seal-gated download.
  - `file_claim` – shared `ClaimRegistry` so auditors can raise disputes without managing the certificate object.
  - `mark_disputed` / `restore_certificate` – helper entry functions for governance flows.

## Getting Started
```bash
cd contracts
sui move build
sui client publish --gas-budget 50000000
```

After publishing, capture the package ID and update the following env vars:
- `backend/.env` → `SUI_PACKAGE_ID`
- `frontend/.env` (or `VITE_API_BASE_URL` if pointing to remote backend)

## Claim Registry Workflow
1. Run `sui move call --function init` once to publish the shared `ClaimRegistry`.
2. Pass the resulting shared object ID to the backend so it can route `/claims` submissions on behalf of auditors.
3. Use `file_claim` to append immutable allegations, which also emit the `ClaimRaised` event for Nautilus/Sui explorers.

## Demo Tips
- Use Devnet to avoid WAL consumption and keep tx histories visible to judges.
- Pair `record_access` calls with the backend’s `dataset_access` audit log for a consistent story across on-chain + off-chain layers.
