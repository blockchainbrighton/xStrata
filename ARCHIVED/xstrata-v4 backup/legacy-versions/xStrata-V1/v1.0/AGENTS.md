# AGENTS.md (Codex)

Instructions for working in this directory tree (`V3-Codex/v3.0.1`).

## Project Summary
This is a vanilla JS + Vite Stacks “inscription” app:
- Chunks files into 8KB pieces, stores them on-chain via `contracts/inscription-core.clar`, and seals with a Merkle root.
- Includes a universal viewer to reconstruct and render content by MIME (with magic-byte sniffing fallbacks).
- Includes resumable minting and extensive wallet/auth diagnostics in the in-app “Journey Log”.

## Key Files
- `src/main.js`: UI + Stacks Connect auth, mint/resume pipeline, viewer, and Journey Log/debug tooling.
- `index.html`: UI (wallet/debug panel, mint controls, drag/drop zone, viewer, journey log).
- `contracts/inscription-core.clar`: Core contract (begin-inscription, add-chunk, seal-inscription).
- `public/manifest.json`: Required by Stacks Connect at `/manifest.json`.

## Run Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`

## Wallet/Auth Notes
- Stacks Connect requires `/manifest.json` to be reachable at the site root.
- Desktop usage typically requires a browser extension wallet provider (Xverse/Leather).
- The app has built-in auth tooling: “Verbose auth logging”, “Dump Auth Debug”, “Reset Wallet Selection”, and “Auth Monitor”.

## Mint/Resume Notes (Large Files)
- Large inscriptions require many sequential signatures (begin + per-chunk + seal).
- “Safe mode” waits for each tx to confirm before continuing; it’s slower but more reliable.
- Fee-per-tx is configurable; the UI also offers a fee-rate fetch + rough cost estimates.
- The app persists the last Inscription ID and some progress hints in `localStorage` to help resume.

## Logging Safety
- The Journey Log attempts to redact secrets/tokens. Treat auth logs as sensitive when sharing externally anyway.

## Editing Guidance
- Preserve existing element IDs in `index.html` (they’re referenced from `src/main.js`).
- If changing auth/debug logging, keep redaction in place.
