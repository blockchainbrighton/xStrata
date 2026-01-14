# xStrata Inscription Registry (Build V7)

## Project Overview
This project is dedicated to building a production-ready, modular web application for the **xStrata Inscription Registry** smart contract (`u64bxr-v7`). The application is being built from scratch with a strict "Contract-First" approach, treating the Clarity contract as the single source of truth.

## Smart Contract Analysis (`contract/u64bxr-v7.clar`)
The core of this project is a SIP-009 compliant NFT contract that implements an "Inscription" system.

**Key Features:**
*   **SIP-009 Compliance:** Implements standard NFT traits (transfer, owner, etc.).
*   **Chunked Uploads:** Data is uploaded in chunks (max 64KB) to on-chain storage.
*   **Merkle Proofs:** Uploads are verified against a Merkle root to ensure data integrity.
*   **Pending State:** Inscriptions go through a "Pending" state where chunks are accumulated before being "Sealed" into a final NFT.
*   **Royalties:** Includes a royalty mechanism for chunk uploads.
*   **On-Chain Storage:** Uses `Chunks` map to store data directly on the Stacks blockchain.

**Key Data Structures:**
*   `Inscriptions`: Stores final NFT data (owner, mime-type, size, sealed status).
*   `PendingInscriptions`: Tracks uploads in progress.
*   `Chunks`: Stores raw data chunks indexed by context hash and index.

**Key Functions:**
*   `begin-inscription`: Initialize a new upload.
*   `add-chunk` / `add-chunk-batch`: Upload data chunks with Merkle proofs.
*   `seal-inscription`: Finalize the upload and mint the NFT.
*   `transfer`: SIP-009 transfer function.

## Development Goals
The primary objective is to implement a frontend that interfaces with this contract.

*   **Stack:** Vite + React + TypeScript.
*   **Methodology:** Strict TDD (Test-Driven Development) using Vitest.
*   **Constraint:** Do **not** rely on previous builds or external code unless absolutely necessary. Derive all logic, data models, and error handling directly from the contract code.
*   **Target:** Testnet first, then Mainnet.

## Architecture Plan
The codebase should follow a clean separation of concerns:
*   `contracts/`: ABI generation, helpers, and contract-specific types.
*   `stacks/`: Network configuration, wallet connection, and transaction handling.
*   `domain/`: Core business logic (Inscriptions, Tokens, Metadata).
*   `ui/`: React components and views.
*   `tests/`: Unit and integration tests.

## Key Files
*   `contract/u64bxr-v7.clar`: **The Authority.** All frontend logic must be derived from this file.
*   `notes`: Detailed instructions and manifesto for the development process.

## Project Mantra - If code behavior changes, tests must prove it; if tests don’t exist, the code isn’t finished.