You are Codex operating inside a real, working but fragile codebase.

Context:
This repository contains a functioning Stacks inscription / NFT / recursive app. It works today, but the original build instructions were lost. The main JavaScript has grown very large, with bundled logic and huge embedded strings (contracts, templates, blobs). Attempts to “unbundle” or refactor in the past have broken the app.

I am not a traditional engineer and have been iterating with AI assistance. The code is messy, but it must continue working exactly as it does now.

Problem:
Future development is becoming impossible because neither you nor I can quickly locate where things live. Every change requires searching the entire repo and guessing. We need structure and navigability without changing runtime behavior.

Constraints (critical):
- Do NOT refactor core logic.
- Do NOT unbundle or re-architect.
- Do NOT change runtime behavior or outputs.
- Assume the current state is the canonical working version.
- Any changes must be additive, incremental, and reversible.

Goal:
Figure out the best way to make this codebase manageable for ongoing AI-assisted development while keeping it working as-is.

What I’m asking you to do:
- First, analyze the repo and understand its structure, pain points, and risks.
- Then design and implement whatever lightweight frameworks, indexing, maps, metadata, or tooling you think are appropriate to:
  • Make it easy to locate code, strings, and responsibilities
  • Give you (and future AI agents) fast orientation
  • Reduce the need to scan entire files blindly
- This may include indexes, manifests, navigation maps, hashes, offsets, CLI helpers, or other non-intrusive scaffolding.
- You decide the approach.

Priority:
Stability and clarity over elegance. Keep the program working. Make future work safer and faster.

Proceed carefully. Explain your reasoning as you go.

Workflow (required for all changes):
- Read `docs/README.md`, then the maps/reports for orientation.
- Scope the smallest additive change that meets the request.
- Update or add tests when behavior or wiring changes.
- When editing `assets/core/index.js`, avoid unescaped backticks or stray Unicode and do not leave escape sequences like `\"` in actual JS code (only use escapes inside string literals). Prefer plain `processLog("...")` over `processLog(\"...\")`. After edits, run:
  - `rg -n "[^\\x00-\\x7F]" assets/core/index.js`
  - `rg -n "\\\\\"" assets/core/index.js`
  - `node -e "const fs=require('fs');new Function(fs.readFileSync('assets/core/index.js','utf8'))"`
- Run `node tests/run-tests.js` after each update.
- For UI/wallet flows, also run the manual checklist in `tests/manual/README.md`.
- If a test is brittle, fix the test logic (not the runtime) unless a real bug is found.

Contract update procedure (full implementation):
- Start from the Clarity source: add/update the `.clar` file in `xstrata-contracts/` for the new version.
- Sync the source into `assets/core/contracts/index.js` as a new `CONTRACT_SOURCE_*` export (the `update_js*.py` scripts currently target old bundles; adapt or update them, or paste manually).
- Wire the new contract mode in the UI and core runtime:
  - Add a mode option to `#top-contract-select` (and `#contract-mode-select` if you keep it in sync).
  - Add a new address input field in `index.html` (`contract-address-<mode>-input`), matching the new mode string.
  - Add a deploy button in the deploy page (`btn-deploy-contract-<mode>`) and label it like the other entries.
  - In `assets/core/index.js`, update mode lists and routing:
    - `validModes` array (init).
    - `getContractDetails` mapping for the new input ID.
    - `getBatchMaxForMode`, `isBatchModeEnabled`, and any mode-specific guards.
    - `renderContractUnavailableMessage` mode grouping.
    - Add the deploy click handler, using the new `CONTRACT_SOURCE_*`.
  - Use `docs/maps/core-index.md` to find the existing blocks; copy the nearest prior version and adjust.
- Update docs/maps and tests:
  - Add the new `CONTRACT_SOURCE_*` entry to `docs/maps/CONTRACTS_MAP.md`.
  - Regenerate `docs/maps/index-map.md` and `docs/maps/core-index.md` if you edited `index.html` or `assets/core/index.js`.
  - Update smoke tests that enumerate modes and embedded sources (`tests/smoke/contracts-embedded.test.js`, `tests/smoke/contract-mode-compat.test.js`, and any tests that hardcode version strings).
- Run checks: `node tests/run-tests.js` and the manual UI checklist in `tests/manual/README.md` if UI or wallet flows changed.

Additional navigation aids:
- Start with `docs/README.md` for doc layout, then see the maps below.
- Start with `docs/reports/ORIENTATION_REPORT.md` and `docs/maps/REPO_MAP.md` for structure.
- Use `docs/maps/core-index.md` for anchors in `assets/core/index.js`.
- Use `docs/maps/index-map.md` for `index.html` IDs and inline handlers.
- Use `docs/maps/CONTRACTS_MAP.md` for contract source inventory.

Index regeneration:
- `node tools/generate-core-index.js` updates `docs/maps/core-index.md`.
- `node tools/generate-index-map.js` updates `docs/maps/index-map.md`.

Runtime notes:
- `index.html` loads `/assets/main.js`, which initializes the optimization layer
  and imports `assets/core/index.js` (the bundled runtime).
- `assets/core/index.js` is tightly coupled to DOM IDs and globals. Avoid edits
  unless explicitly requested.
