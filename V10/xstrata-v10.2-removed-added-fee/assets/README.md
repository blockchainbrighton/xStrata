# Assets Directory (runtime modules)

This folder contains the runtime JavaScript modules used by `index.html`.
It is not a separate refactor or drop-in package; the files here are the live
assets for this repo.

## Key files
- `main.js`: entry module loaded by `index.html`; initializes optimization and globals.
- `core/index.js`: large bundled core logic; treat as canonical runtime.
- `core/contracts/index.js`: embedded contract source strings used for deploy.
- `api/optimization.js`: fetch proxying and request normalization for Hiro API.
- `components/connect-modal.js`: wallet connect modal UI and styles.
- `utils/globals.js`: global function wiring for inline HTML handlers.

## Notes
- Avoid refactoring or unbundling `core/index.js`. Small edits can break runtime.
- For navigation, use `docs/maps/core-index.md` and `docs/maps/index-map.md`.
