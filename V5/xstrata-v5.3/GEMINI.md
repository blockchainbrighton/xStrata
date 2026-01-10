# XStrata V5 Optimised

**Project Type:** Blockchain Application (Stacks)
**Primary Language:** JavaScript (Node.js/Frontend), Clarity (Smart Contracts)
**Context:** Stacks Inscription Service & Audio/Visual Gallery

## Project Overview
XStrata is a tool for inscribing data (images, audio, etc.) onto the Stacks blockchain. It uses a "chunking" mechanism to bypass transaction size limits, storing file data across multiple transactions and "sealing" them with a Merkle root for integrity. This directory (`xstrata-v5-optimised`) appears to be a production-ready or optimized build of the application, utilizing a custom Node.js server for API proxying.

## Architecture

### 1. Frontend
*   **Entry Point:** `index.html`
*   **Logic:** `assets/index-06f51251-2.js` (Minified/Bundled, likely from Vite).
*   **Functionality:**
    *   Connects to Stacks Wallet (Hiro/Xverse).
    *   Handles file selection, chunking (16KB-64KB), and Merkle tree generation.
    *   Manages the inscription transaction flow: `begin -> add-chunk (loop) -> seal`.
    *   **Viewer:** Includes a gallery and media player for inscribed content.

### 2. Backend / Proxy
*   **File:** `server.js`
*   **Purpose:**
    *   Serves static files (`index.html`, assets).
    *   **Hiro API Proxy:** Proxies requests to `api.mainnet.hiro.so` and `api.testnet.hiro.so` via `/hiro-proxy/` to hide the API key and handle CORS.
*   **Running:** `node server.js` (Runs on Port 8001).

### 3. Smart Contract
*   **File:** `contracts/u64bxr-v4.clar`
*   **Name:** `u64bxr-v4` (Batch XR Version 4)
*   **Status:** **OPTIMIZED**.
    *   Optimized to reduce gas costs (removed redundant `PendingChunkFlags` map).
    *   Streamlined logic for `add-chunk` and `add-chunk-batch`.
*   **Key Functions:**
    *   `begin-inscription`: Initialize metadata.
    *   `add-chunk`: Upload single chunk (with optional royalty).
    *   `add-chunk-batch`: Upload up to 10 chunks in one TX (with batched royalty).
    *   `seal-inscription`: Finalize and mint the ID.
*   **Remaining TODOs:**
    *   Update `CONTRACT-OWNER` and `royalty-recipient` to mainnet addresses before deployment.
    *   Verify data integrity checks.

## Key Documentation
*   **`INSCRIPTION_PROCESS.md`**: Detailed technical walkthrough of the user journey vs. technical actions (Preparation, Init, Upload Loop, Sealing).
*   **`TODO.md`**: **READ THIS FIRST.** Contains critical "readiness" findings for Mainnet.
    *   *Critical:* Royalty recipient is a testnet address.
    *   *High:* Missing data integrity verification in `seal-inscription`.
    *   *Medium:* Unbounded chunk counts.
*   **`roadmap_audio.txt`**: Plans for Local Storage Auto Resume and Smart Contract Batching.

## Quick Start
1.  **Start Server:**
    ```bash
    node server.js
    ```
2.  **Access:** Open `http://localhost:8001` in your browser.

## Current Focus & Context
*   **Audio Engine:** The user is working on a "high-fidelity 80s synthwave audio engine" using Web Audio API (FM synthesis, gated reverb).
*   **Contract Hardening:** The `u64bxr-v3` contract needs to be patched for mainnet security (integrity checks) and proper royalty configuration before deployment.
*   **UX Improvements:** "Resume Inscription" functionality is a priority to handle interrupted uploads.
