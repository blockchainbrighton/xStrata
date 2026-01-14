# Stacks Inscription Protocol (SIP-Proto)

> A robust, open-source protocol for inscribing, storing, and composing generic data on the Stacks blockchain (Bitcoin L2).

**Version folder:** `V3-Codex/v3.0.1`

## 🚀 Overview

This project provides a complete end-to-end system for permanently storing data on the Stacks blockchain. Unlike simple text storage or expensive Layer 1 Ordinals, this protocol utilizes Stacks smart contracts to enable **high-capacity, verifiable, and programmable data storage**.

It supports **any file type** (Images, Audio, Video, Code, PDFs) and introduces **Recursive Inscriptions**—the ability to compose complex applications or media by referencing existing on-chain data.

## ✨ Key Features

*   **📦 Smart Chunking**: Automatically splits large files into 8KB chunks to bypass transaction size limits, enabling the storage of high-fidelity media (MBs in size).
*   **🔒 Cryptographic Verification**: Generates a SHA-256 Merkle Root for every file. The smart contract seals the inscription with this root, ensuring data integrity.
*   **⏯️ Resumable Uploads**: The client checks on-chain state before uploading. If a transaction fails or the browser closes, you can resume exactly where you left off without paying for the same chunk twice.
*   **🧾 Large Mint Guidance**: Clear UI guidance for large inscriptions (how many signatures/txs are required, how to safely proceed, how to resume).
*   **💸 Fee & Cost Estimation**: Configurable fee-per-transaction with a rough total cost estimate; optional network fee-rate fetch for an additional estimate.
*   **✅ Safe Mode**: Optional “wait for confirmation” mode that polls the chain after each tx for better reliability on large uploads.
*   **🎼 Universal Renderer**: The built-in viewer automatically detects and renders:
    *   **Audio** (WebM, WAV, OGG) with a Web Audio API engine.
    *   **Images** (PNG, JPG, GIF, SVG).
    *   **Video** (MP4, WebM).
    *   **Documents** (PDF, HTML) in sandboxed frames.
    *   **Code/Data** (JSON, Text).
*   **🔄 Recursive Composability**: Supports "Manifest" inscriptions (JSON) that reference other inscription IDs. The player can fetch these dependencies and combine them dynamically (e.g., stitching audio clips into a seamless track).
*   **🧰 Wallet Diagnostics**: Built-in auth debugging tools to troubleshoot provider detection, Stacks Connect handshakes, and session state.
*   **🖱️ Drag & Drop**: Drag a file directly into the Mint view, or choose via the file picker.

## 🛠 Architecture

### The Smart Contract (`contracts/inscription-core.clar`)
A generic storage engine that:
1.  **Registers** an inscription (MIME type, size, chunk count).
2.  **Stores** raw data chunks (up to 8KB each) in a `Chunks` map.
3.  **Seals** the record with a Merkle Root, preventing further modification.

### The Client (`src/main.js`)
A vanilla JavaScript + Vite application that handles:
1.  **File Processing**: Reads files into `ArrayBuffers`, calculates hashes/Merkle roots.
2.  **Wallet Interaction**: Manages Stacks Connect authentication and transaction signing.
3.  **Data Reconstruction**: Fetches chunks from the chain, validates integrity, and rebuilds the original file for playback.
4.  **Auth + Debug UI**: Captures wallet/provider state in the on-page Journey Log and exposes helper buttons for troubleshooting.

## 🏁 Getting Started

### Prerequisites
*   Node.js (v16+)
*   A Stacks wallet provider in your browser (e.g., Xverse or Leather browser extension) configured for **Testnet**.

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd stacks-inscription-app

# Install dependencies
npm install
```

### Running the App

```bash
npm run dev
```

Open `http://localhost:5173` (or the port shown in your terminal).

### Stacks Connect Manifest
Stacks Connect authentication requires a manifest at `/manifest.json`. This project provides `public/manifest.json`, which Vite serves automatically. If you deploy behind a different static server, ensure `/manifest.json` is reachable at the site root.

## 🔐 Wallet UI + Debugging
The wallet card includes:
*   **Connect Wallet / Disconnect**: Connect is required for deploy/mint; viewing inscriptions works without a wallet.
*   **Status text**: Explains whether you’re connected and what requires a wallet.
*   **Verbose auth logging**: Enables extra auth/provider/session diagnostics in the Journey Log.
*   **Dump Auth Debug**: Logs a snapshot of provider detection, session state, and manifest availability.
*   **Reset Wallet Selection**: Clears any stale wallet selection and forces reselection if auth gets “stuck”.
*   **Start/Stop Auth Monitor**: Polls for auth/provider/storage state transitions and logs changes.

Security note: the Journey Log attempts to redact secrets/tokens, but treat auth logs as sensitive.

## 📖 Usage Guide

### 1. Deploy the Contract (Optional)
If you want to run your own instance of the registry:
1.  Connect your wallet.
2.  Click **"Deploy Contract"**.
3.  Wait for the transaction to confirm. The app will automatically target your new contract.

*Note: You can also use the default provided Testnet contract.*

### 2. Inscribe Data
1.  Select a file via the file picker, or drag & drop into the drop zone.
2.  The app will calculate the Merkle Root and chunk count.
3.  Click **"Begin Inscription"**.
4.  **Step 1 (Init)**: Confirms the ID on-chain.
5.  **Step 2 (Upload)**: Automatically signs transactions for each chunk.
6.  **Step 3 (Seal)**: Finalizes the inscription.

If the flow is interrupted, use **“Resume / Retry Inscription”** in Mint Mode to scan on-chain chunks and only upload what’s missing.

Notes for large inscriptions:
*   The app will display (and persist) your **Inscription ID**. Save it; this is what you enter to resume.
*   Consider enabling **Safe mode** for large uploads.
*   Set **Fee per transaction (microSTX)** high enough to avoid “fee too low” failures; use **Fetch Fee Rate** for a rough reference.

### 3. View / Play
1.  Copy the **Inscription ID** (provided after minting).
2.  Go to the **Inscription Viewer** tab.
3.  Paste the ID and click **"Load & View"**.
4.  The content will be fetched from the blockchain and rendered.

### 4. Recursive Audio (Advanced)
1.  Create a JSON file containing a list of Inscription IDs: `[12, 15, 22]`.
2.  Inscribe this JSON file.
3.  Load the resulting ID in the viewer using **"Process Recursive Manifest (JSON)"**.
4.  The engine will fetch all referenced audio tracks and play them sequentially.

## 🧩 Troubleshooting
### Connect shows “canceled” or doesn’t sign in
*   Ensure you have a browser wallet provider installed/unlocked (Xverse/Leather extension). Being logged into a separate web wallet page is not enough.
*   Confirm `/manifest.json` loads (visit `http://localhost:5173/manifest.json`).
*   Click **Reset Wallet Selection**, then retry **Connect Wallet**.
*   Enable **Verbose auth logging** and check the Journey Log for the underlying error (it will also log provider capability checks).

### Mint fails partway through (large file)
*   This usually means a chunk tx was canceled or the wallet/provider errored mid-batch. The inscription remains incomplete but can be resumed.
*   Reload the original file, then use **Resume / Retry Inscription** with your ID.
*   Turn on **Safe mode** and consider increasing **Fee per transaction**.

## 🤝 Contributing

We welcome contributions! Please see `contracts/` for the Clarity logic and `src/` for the frontend integration.

## 📄 License

MIT
