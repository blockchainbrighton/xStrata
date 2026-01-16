# Tests

This folder contains lightweight smoke tests plus manual checklists.

## Automated smoke tests
Run all automated checks:
```bash
node tests/run-tests.js
```

Run after each update to the repo.

## When to add or update tests
- If you touch `index.html` or DOM IDs, update/extend `tests/smoke/dom-id-sync.test.js`.
- If you change entrypoints or module wiring, update `tests/smoke/entrypoints.test.js`.
- If you modify proxying or fetch behavior, update `tests/smoke/optimization-layer.test.js`.
- If you alter contract embedding or deploy modes, update `tests/smoke/contracts-embedded.test.js`.
- If you change server behavior or static assets, update `tests/smoke/server-static.test.js`.
- If you move docs or change docs layout, update `tests/smoke/docs-layout.test.js`.

What they cover:
- Entrypoints and module wiring (`index.html` -> `assets/main.js`).
- DOM ID sync between `index.html` and `assets/core/index.js`.
- Embedded contract sources are present and non-empty.
- Optimization layer fetch override and proxy logic.
- Local server serves key static assets.
- Docs layout and required files exist.

Notes:
- The server smoke test starts `server.js` on port 8001. Stop any running
  server before running tests.
- Network calls to Hiro are not exercised; proxy behavior is checked by
  static analysis only.

## Manual test checklist
See `tests/manual/README.md` for step-by-step UI flows to validate wallet,
mint, resume, and viewer behavior.
