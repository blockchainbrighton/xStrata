# Contract Mode Guide (v7 to v9.2)

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
| batchxr v9.2.4 | Sequential hash (ordered) | On-chain upload state | Lower | Skips self-royalty transfers |

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
- `assets/core/index.js` uses sequential hashing for **v9.2 / v9.2.2 / v9.2.3 / v9.2.4**.
- v9 remains Merkle‑proof based.
- Sequential resume uses the on-chain `current-index` and uploads remaining chunks
  in order (Merkle modes still scan missing chunks).
- Sequential modes now wait for upload transaction confirmation before sealing
  to avoid `ERR-HASH-MISMATCH` on the seal step.
- `(err u2)` on chunk upload is not a contract constant; it usually comes from
  `stx-transfer?`. When the royalty recipient equals the sender, some nodes
  reject self-transfers. v9.2.4 skips the self-royalty transfer to avoid this.
