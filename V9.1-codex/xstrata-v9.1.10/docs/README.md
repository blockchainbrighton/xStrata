# Docs Index

Use this directory for navigation and reference materials.

## Folders
- `docs/maps/`: generated and curated maps (core/index/contract/repo).
- `docs/reports/`: consolidated reports and summaries.
- `docs/process/`: workflow and process documentation.
- `docs/context/`: project context and high-level summaries.
- `docs/notes/`: open questions, TODOs, and working notes.

Key process docs:
- `docs/process/INSCRIPTION_PROCESS.md`
- `docs/process/CONTRACT_MODE_GUIDE.md`

## Generators
- `node tools/generate-core-index.js` -> `docs/maps/core-index.md`
- `node tools/generate-index-map.js` -> `docs/maps/index-map.md`

## Testing (run after each update)
- Automated smoke tests: `node tests/run-tests.js`
- Manual UI checklist: `tests/manual/README.md`
- Add or update tests whenever you change behavior or wiring.
