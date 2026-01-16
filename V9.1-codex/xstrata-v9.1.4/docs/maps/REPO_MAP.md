# Repo Map (orientation only)

This file is additive scaffolding to make navigation safer. It does not change runtime behavior.

## Entry points
- `index.html`: UI skeleton, inline styles, and page layout; loads `/assets/main.js`.
- `assets/main.js`: initializes optimization + globals and re-exports core modules.
- `assets/core/index.js`: bundled core logic and embedded strings; treat as canonical runtime.

## Core runtime bundles
- `assets/core/index.js`: large, bundled logic; avoid editing directly unless necessary.
- `assets/components/connect-modal.js`: wallet modal component and embedded styles.
- `assets/api/optimization.js`: API proxying/normalization layer.
- `assets/utils/globals.js`: restores globals for HTML event handlers.

## Contracts
- `assets/core/contracts/index.js`: embedded contract sources used at runtime.
- `xstrata-contracts/*.clar`: external Clarity sources by version.
- `xstrata-contracts/update_js*.py`: scripts used to sync contract sources into JS.

## Server / proxy
- `server.js`: static server + `/hiro-proxy/` (Hiro API proxy).

## UI + static assets
- `good-things-come.html`: loading animation used in viewer overlay iframe.
- `manifest.json`: app manifest served at site root.

## Tests
- `tests/README.md`: test overview.
- `tests/run-tests.js`: smoke test runner.
- `tests/smoke/`: automated checks for wiring, IDs, embedded contracts, server.
- `tests/manual/`: manual UI validation checklist.

## Supporting docs
- `docs/process/INSCRIPTION_PROCESS.md`: step-by-step mint flow.
- `docs/notes/TODO.md`: open questions and contract readiness notes.
- `docs/context/GEMINI.md`: project context summary.

## Safe navigation helpers
- `docs/maps/core-index.md`: generated anchors, DOM IDs, localStorage keys, contract calls.
- `docs/maps/index-map.md`: generated map of `index.html` headings, IDs, inputs, buttons, handlers.
- `docs/maps/CONTRACTS_MAP.md`: contract source map.
- `docs/reports/ORIENTATION_REPORT.md`: consolidated repo orientation and risk notes.
- `tools/generate-core-index.js`: regenerates `docs/maps/core-index.md`.
- `tools/generate-index-map.js`: regenerates `docs/maps/index-map.md`.

## Risks to keep in mind
- `assets/core/index.js` is bundled; even small edits can break runtime.
- Prior unbundling/refactors have broken the app; keep changes additive and reversible.
- Core logic is tightly coupled to DOM IDs and inline handlers in `index.html`.
- `window.fetch` is overridden by the optimization layer; proxy availability affects API behavior.
