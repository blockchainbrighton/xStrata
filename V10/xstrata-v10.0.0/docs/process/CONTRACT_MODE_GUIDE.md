# Contract Mode Guide (v7 to v9.2.11)

This guide summarizes the available on-chain modes and their tradeoffs.
It is descriptive only and does not change runtime behavior.

## Summary table

| Mode | Hashing / Integrity | Resume support | Cost profile | Notes |
| --- | --- | --- | --- | --- |
| legacy (u64) | Merkle proofs per chunk | On-chain pending maps | Higher | Oldest mode, smallest feature set |
| batch (u64b) | Merkle proofs per batch | On-chain pending maps | Higher | Batch proofs reduce tx count |
| batchx (u64bx) | Merkle proofs per batch | On-chain pending maps | Higher | Similar to batch with higher limits |
| batchxr v7 | Merkle proofs per chunk/batch | On-chain pending maps | Higher | Strong integrity, good resume |
| batchxr v6 | Merkle proofs per chunk/batch | On-chain pending maps | Higher | Pre‑v9 model |
| batchxr v9 | Merkle proofs per chunk | Limited (no read-only pending state in contract) | Higher | Integrity strong, resume is limited |
| batchxr v9.2 | Sequential hash (ordered) | On-chain upload state | Lower | Cheaper, ordered uploads required |
| batchxr v9.2.2 | Sequential hash (ordered) | On-chain upload state | Lower | Same interface as v9.2 |
| batchxr v9.2.3 | Sequential hash (ordered) | On-chain upload state | Lower | Same interface as v9.2 |
| batchxr v9.2.5 | Sequential hash (ordered) | On-chain upload state | Lower | Skips self-royalty transfers |
| batchxr v9.2.6 | Sequential hash (ordered) | On-chain upload state | Lower | Self-royalty safe; 16 KB chunks; batch size up to 20 |
| batchxr v9.2.7 | Sequential hash (ordered) | On-chain upload state | Lower | Self-royalty safe; 16 KB chunks; batch size up to 50 |
| batchxr v9.2.8 | Sequential hash (ordered) | On-chain upload state | Lower | Royalties on begin + seal; 16 KB chunks; batch size up to 50 |
| batchxr v9.2.9 | Sequential hash (ordered) | On-chain upload state | Lower | Embedded SVG token URI; royalties on begin + seal; 16 KB chunks; batch size up to 50 |
| batchxr v9.2.10 | Sequential hash (ordered) | On-chain upload state | Lower | SIP-009 token URI map; royalties on begin + seal; 16 KB chunks; batch size up to 50 |
| batchxr v9.2.11 | Sequential hash (ordered) | On-chain upload state | Lower | SIP-009 token URI map; defaults to a URL token URI in the app; 16 KB chunks; batch size up to 50 |

## Merkle vs Sequential (plain language)
- **Merkle proofs**: Each chunk is verified against the final file hash using a
  proof. Strong per‑chunk integrity, but larger transactions (more cost).
- **Sequential hashing**: Each chunk updates a running hash on-chain. This
  guarantees the final hash, but depends on strict ordering of chunks.
  It is cheaper because there are no proofs.

## Choosing a mode
- **Need maximum integrity**: pick a Merkle mode (v7/v6/v9).
- **Need lower fees**: pick v9.2+ (sequential hashing).
- **Need best resume**: pick v7/v6/v9.2+ (they expose pending/upload state).

## Implementation notes (current app)
- `assets/core/index.js` uses sequential hashing for **v9.2 / v9.2.2 / v9.2.3 / v9.2.5 / v9.2.6 / v9.2.7 / v9.2.8 / v9.2.9 / v9.2.10 / v9.2.11**.
- v9 remains Merkle‑proof based.
- Sequential resume uses the on-chain `current-index` and uploads remaining chunks
  in order (Merkle modes still scan missing chunks).
- Sequential modes now wait for upload transaction confirmation before sealing
  to avoid `ERR-HASH-MISMATCH` on the seal step.
- `(err u2)` on chunk upload is not a contract constant; it usually comes from
  `stx-transfer?`. When the royalty recipient equals the sender, some nodes
  reject self-transfers. v9.2.5 skips the self-royalty transfer to avoid this.
- v9.2.8 moves royalties to the begin + seal steps (0.1 STX at begin, 0.1 STX
  base at seal, plus 0.01 STX per chunk).
- v9.2.9 embeds a fixed SVG data URI for `get-token-uri`.
- v9.2.10 stores token URIs in a per-id map for SIP-009 compatibility.
- v9.2.11 keeps the per-id URI map but defaults the seal token URI to a URL in the app.

## Contract update checklist (quick)
1) Add/update the Clarity source in `xstrata-contracts/`.
2) Sync the source into `assets/core/contracts/index.js` as a new `CONTRACT_SOURCE_*` export.
3) Update `index.html`:
   - Add the new mode option in `#top-contract-select` (and `#contract-mode-select` if kept in sync).
   - Add a new `contract-address-<mode>-input` field with the default address.
   - Add a deploy button `btn-deploy-contract-<mode>` in the Deploy section.
4) Update `assets/core/index.js`:
   - Extend `validModes`, `getContractDetails`, and any mode-specific guards.
   - Add the deploy button handler using the new `CONTRACT_SOURCE_*`.
   - Update `renderContractUnavailableMessage`, `getBatchMaxForMode`, etc.
5) Update maps/tests:
   - `docs/maps/CONTRACTS_MAP.md` and regenerate `docs/maps/index-map.md`/`docs/maps/core-index.md` as needed.
   - Update smoke tests that enumerate modes and embedded sources.
6) Run `node tests/run-tests.js` and the UI checklist in `tests/manual/README.md` if UI/wallet flows changed.
