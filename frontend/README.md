# DataCert Frontend (Vite + React + TypeScript)

This dashboard is the primary UX for the Walrus Haulout Hackathon submission. It lets dataset creators mint provenance certificates, auditors raise claims, and buyers request gated access – all backed by the Express API in `../backend`.

## Commands
```bash
npm install
npm run dev   # http://localhost:5173
npm run build
```

Set `VITE_API_BASE_URL` (defaults to `http://localhost:4000`) to point at the backend during demos.

## Feature Tour
- **Walrus Provenance Wizard** – Upload a dataset file, capture metadata, choose Seal access policy, and auto-mint a Sui certificate.
- **Registry Grid** – Live view of certified datasets with license, category, and revenue metrics (sourced from backend).
- **Dataset Detail** – Timeline visualization, Walrus blob hashes, and action panels for claims + access requests.
- **Claims & Access flows** – Forms wire directly into `/api/datasets/:id/claims` and `/api/datasets/:id/access` for end-to-end demoability.

## Styling
Custom CSS (no Tailwind) keeps the bundle small for hackathon demos while still showcasing a polished "control tower" aesthetic.
