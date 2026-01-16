# Contracts Map

This file documents where contract sources live and which versions exist.

## Embedded contract sources (runtime)
From `assets/core/contracts/index.js`:
- `CONTRACT_SOURCE` (~2.6 KB)
- `CONTRACT_SOURCE_BATCH` (~3.4 KB)
- `CONTRACT_SOURCE_BATCHX` (~3.4 KB)
- `CONTRACT_SOURCE_BATCHXR` (~3.6 KB)
- `CONTRACT_SOURCE_BATCHXR_V6` (~12.6 KB)
- `CONTRACT_SOURCE_BATCHXR_V9` (~8.0 KB)
- `CONTRACT_SOURCE_BATCHXR_V9_2` (~8.9 KB)
- `CONTRACT_SOURCE_BATCHXR_V9_2_2` (~9.2 KB)
- `CONTRACT_SOURCE_BATCHXR_V9_2_3` (~9.2 KB)
- `CONTRACT_SOURCE_BATCHXR_V9_2_4` (~9.2 KB)

These strings are the sources the frontend uses at runtime.

## External Clarity sources
From `xstrata-contracts/`:
- `sip009-nft-trait.clar`
- `u64bxr-v7.clar`
- `u64bxr-v9.clar`
- `u64bxr-v9.2.clar`
- `u64bxr-v9.2.2.clar`
- `u64bxr-v9.2.3.clar`
- `u64bxr-v9.2.4.clar`

## Sync helpers
- `xstrata-contracts/update_js.py`
- `xstrata-contracts/update_js_v2.py`

These likely generate/update the embedded contract strings.

## Contract modes in UI
`index.html` exposes these modes:
- legacy, batch, batchx, batchxr, batchxrv3, batchxrv9, batchxrv9-2, batchxrv9-2-2, batchxrv9-2-3, batchxrv9-2-4

Note: v9.2 / v9.2.2 / v9.2.3 use a sequential hash in `assets/core/index.js`.
v9 remains Merkle‑proof based.
