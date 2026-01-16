# Orientation Report (current)

This report consolidates repo orientation based on current structure and code.
It is descriptive only and does not propose changes.

## 1) Repo map
- `index.html`: main UI layout and inline styles; loads `/assets/main.js`.
- `assets/`: runtime modules.
  - `assets/main.js`: initializes optimization + globals; imports core.
  - `assets/core/index.js`: bundled core logic; primary runtime.
  - `assets/core/contracts/index.js`: embedded contract sources.
  - `assets/api/optimization.js`: Hiro proxy fetch rewrite.
  - `assets/components/connect-modal.js`: wallet modal UI + styles.
  - `assets/utils/globals.js`: inline handler globals.
- `server.js`: static server and Hiro API proxy with API key.
- `good-things-come.html`: loading animation used by the viewer overlay.
- `manifest.json`: app manifest (auth expects it at site root).
- `xstrata-contracts/`: Clarity sources and sync scripts.
- `docs/`: navigation maps and this report.
- `docs/process/INSCRIPTION_PROCESS.md`: step-by-step mint flow.
- `docs/notes/TODO.md`: open questions and contract readiness notes.
- `docs/context/GEMINI.md`: project context summary.

## 2) Execution path
- Entry: `index.html` loads `/assets/main.js`.
- `assets/main.js` runs immediately:
  - Initializes `assets/api/optimization.js` (overrides `window.fetch`).
  - Initializes `assets/utils/globals.js`.
  - Imports `assets/core/index.js`.
- `assets/core/index.js` executes on import:
  - Sets up auth and UI, attaches globals, binds event listeners.
  - Drives minting, gallery, and viewer flows.
- Optional local server: `server.js` hosts static assets and `/hiro-proxy/`.

## 3) Responsibilities map

**Wallet / auth**
- `assets/core/index.js`: Stacks connect flow, auth state, provider detection.
- `assets/components/connect-modal.js`: wallet selection modal UI.
- `index.html`: wallet UI controls.

**Contract calls (read-only vs public)**
- `assets/core/index.js`: `callReadOnlyFunction*`, `openContractCallWrapper`,
  deploy calls, tx polling, and status checks.
- `assets/core/contracts/index.js`: contract sources for deploy.
- `assets/api/optimization.js`: Hiro API fetch rewrite to `/hiro-proxy/`.

**Inscription / chunking / proofs**
- `assets/core/index.js`: chunking, Merkle/sequential hashing, proof building,
  upload loop, resume scan, sealing, ID lookup.
- `index.html`: mint UI inputs and status sections.

**Media handling (image/audio/html)**
- `assets/core/index.js`: MIME sniffing, audio decoding, image/video/html viewer.
- `index.html`: viewer layout and media container.
- `good-things-come.html`: loading animation iframe.

**UI components**
- `index.html`: core layout and styling.
- `assets/components/connect-modal.js`: modal UI.
- `assets/core/index.js`: DOM wiring and dynamic UI updates.

## 4) Large embedded assets inventory
- `assets/core/contracts/index.js`: contract source strings (2.6 KB to ~12.6 KB).
- `assets/components/connect-modal.js`: embedded CSS string (~10.2 KB) and base64 icon.
- `index.html`: inline `<style>` block (~6.1 KB).
- `assets/core/index.js`: large bundled libraries and app logic (~1.07 MB).

## 5) Risk areas
- `assets/core/index.js` is bundled and tightly coupled to DOM IDs.
- Inline handlers in `index.html` depend on globals attached at runtime.
- Global state in core (current file, chunks, fee state, auth state) is shared
  across flows and can desync if modified incorrectly.
- `window.fetch` is overridden by the optimization layer; proxy availability
  affects behavior and diagnostics.
- Contract sources are duplicated between JS-embedded strings and external
  Clarity files; drift can cause confusion.
