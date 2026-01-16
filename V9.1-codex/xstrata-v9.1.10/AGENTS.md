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
- Run `node tests/run-tests.js` after each update.
- For UI/wallet flows, also run the manual checklist in `tests/manual/README.md`.
- If a test is brittle, fix the test logic (not the runtime) unless a real bug is found.

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
