# XStrata V4.0

The streamlined, production-ready version of the XStrata Inscription protocol.

## Overview

V4.0 combines the robust build pipeline of V1 with the advanced batching and smart contract logic of V3.10.

- **Frontend:** Pure Vite + Vanilla JS (No framework bloat).
- **Contract:** `inscription-v4` (based on `u64bxr-v3`), supporting 64KB chunks and batched uploads.
- **Library:** Custom Merkle Tree implementation for on-chain verification.

## Architecture

- `contracts/`: Contains the Clarity smart contract.
- `src/main.js`: Core application logic (Wallet connection, Minting loop, Viewer).
- `src/lib/merkle.js`: Merkle Tree generation and Proof construction.
- `src/lib/audio-engine.js`: Recursive audio processing for playback.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start Dev Server:
   ```bash
   npm run dev
   ```

3. Build for Production:
   ```bash
   npm run build
   ```

## Key Features

- **Fixed Chunk Size:** 64 KB (65536 bytes).
- **Batch Uploads:** Supports 6, 8, or 10 chunks per transaction.
- **Resilience:** Built-in retry logic for API calls.
- **Security:** Merkle Proof verification for every chunk.