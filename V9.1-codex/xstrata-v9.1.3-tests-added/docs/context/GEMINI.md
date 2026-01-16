# XStrata v9.1 Codex (current)

**Project Type:** Stacks inscription + viewer application
**Primary Languages:** JavaScript (frontend + Node), Clarity (contracts)
**Status:** Working build with bundled core logic; treat current state as canonical.

## Overview
XStrata inscribes files on Stacks by chunking data, writing chunks on-chain,
and sealing the inscription. It also includes a gallery and media viewer.

## Architecture (current)

### Frontend
- **Entry:** `index.html`
- **Module entry:** `assets/main.js`
- **Core runtime:** `assets/core/index.js` (large bundle, avoid refactors)
- **Wallet modal:** `assets/components/connect-modal.js`
- **Proxy layer:** `assets/api/optimization.js`

### Backend / Proxy
- **File:** `server.js`
- **Purpose:** static hosting + `/hiro-proxy/` for Hiro API (adds API key and CORS).
- **Run:** `node server.js` (port 8001)

### Smart Contracts
- **Embedded sources (runtime deploy):** `assets/core/contracts/index.js`
- **External sources:** `xstrata-contracts/*.clar`
- **Sync helpers:** `xstrata-contracts/update_js.py`, `xstrata-contracts/update_js_v2.py`

## Key docs
- `docs/process/INSCRIPTION_PROCESS.md`: end-to-end mint flow and UX.
- `docs/maps/REPO_MAP.md`: top-level map and risks.
- `docs/maps/core-index.md`: generated index of core anchors/IDs/keys/calls.
- `docs/maps/index-map.md`: generated index of `index.html` IDs and handlers.
- `docs/maps/CONTRACTS_MAP.md`: contract source inventory.
- `docs/reports/ORIENTATION_REPORT.md`: consolidated orientation summary.

## Current defaults and behavior
- Chunk size is sourced from `#chunk-size-select` (hidden by default), default 64 KB.
- Batch modes are enabled for certain contracts; v9 modes use a sequential hash
  instead of a Merkle root.
- The app initializes on testnet by default (`StacksTestnet` in core).

## Caution
- Do not unbundle or re-architect `assets/core/index.js`.
- Avoid changing DOM IDs without updating core logic.
