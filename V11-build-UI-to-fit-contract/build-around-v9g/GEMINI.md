# xStrata Project Context

## Project Overview
This project focuses on the development of **xStrata**, an inscription-based NFT protocol on the Stacks blockchain. The core logic allows for on-chain data storage through a chunked upload mechanism, Merkle proof verification, and recursive dependencies between inscriptions.

The immediate goal is to **build a modular, production-ready frontend application** from scratch, using the provided Clarity smart contract as the single source of truth.

## Directory Structure
- `contract/u64bxr-v9.clar`: The canonical Clarity smart contract.
- `notes`: Detailed instructions and architectural mandates for the frontend build.

## Core Smart Contract (`u64bxr-v9.clar`)
The contract implements a SIP-009 compatible NFT with advanced storage capabilities:

### Key Features
*   **Chunked Storage:** Data is uploaded in chunks (max 64KB) to bypass transaction size limits.
*   **Merkle Verification:** Chunks are verified against a Merkle root hash to ensure data integrity before storage.
*   **Recursive Inscriptions:** Inscriptions can declare dependencies on other existing inscriptions (DAG structure).
*   **Royalties:** Built-in royalty enforcement per chunk.

### Critical Functions
*   `begin-inscription`: Initializes a pending upload with a hash, mime-type, and size.
*   `add-chunk`: Uploads a data chunk, verifying it against the declared Merkle root.
*   `seal-inscription`: Finalizes the upload, minting the NFT.
*   `seal-recursive`: Same as seal, but records dependencies.

## Development Mandates
**Strict adherence to the `notes` file is required.**

1.  **Contract-First Design:** All frontend models, types, and logic must be derived *directly* from the contract ABI. Do not assume behavior.
2.  **Clean Slate:** The frontend must be built from scratch using **Vite + React + TypeScript**.
3.  **Modular Architecture:**
    *   `contracts/`: ABI, metadata, helpers.
    *   `stacks/`: Network interactions, wallet connection.
    *   `domain/`: Business logic (inscriptions, parsing).
    *   `ui/`: Reusable components.
4.  **Watertight TDD:** No module is implemented without passing tests (using **Vitest**).

## Operational Guide
*   **Environment:** `node`, `npm`, and `clarinet` are available.
*   **Testing:** Run contract tests via `clarinet test` (if configured) or unit tests via `npm test` (once the frontend is initialized).
*   **Reference Builds:** Do not access previous builds unless explicitly blocked by an ambiguity that cannot be resolved via the contract code.

## Project Mantra - If code behavior changes, tests must prove it; if tests don’t exist, the code isn’t finished.