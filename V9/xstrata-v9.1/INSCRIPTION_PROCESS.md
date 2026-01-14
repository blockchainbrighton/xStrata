# XStrata Inscription Process - Technical Walkthrough

This document details the step-by-step technical flow of inscribing a file using the XStrata application. It maps the User Journey to the underlying Technical Actions (API calls, Wallet interactions, Smart Contract functions).

## 1. Preparation & File Selection

**User Action:** 
- User selects a file (e.g., an image or audio file) from their device.

**Technical Process:**
1.  **File Reading:** The browser reads the file into an `ArrayBuffer`.
2.  **Chunking:** The file is split into 16KB chunks (default). 
    - *Why?* Stacks transactions have a size limit (typically ~256KB, but lower is safer for propagation). 16KB is a safe, efficient size.
3.  **Merkle Root Calculation:** A Merkle Root hash (`buff 32`) is computed from all the chunk hashes. 
    - *Intention:* This root acts as the unique ID for the file content throughout the process.
4.  **Duplicate Check:** 
    - The app checks `lastSealedRoot`. If the user just inscribed this file in the current session, it blocks the process.
    - It calls `get-pending-inscription(root, user_address)` on the smart contract.
    - *Result:* If a pending inscription exists, the UI switches to "Resume" mode. If not, it shows "Begin Inscription".

## 2. Initialization (Step 1)

**User Action:**
- User clicks **"Begin Inscription"**.

**Technical Process:**
1.  **Wallet Prompt:** The app triggers a Stacks transaction: `begin-inscription`.
    - **Arguments:** `(hash, mime-type, total-size, chunk-count)`
2.  **Contract Logic:** 
    - The contract creates an entry in the `PendingInscriptions` map.
    - It stores the metadata but *no data* yet.
3.  **Polling:** The app waits for the transaction ID (`txid`) to confirm.
    - *API Call:* `/extended/v1/tx/{txid}?_t={timestamp}` (via Proxy)
    - *Intention:* We cannot start uploading chunks until the "container" is created on-chain.

## 3. Uploading Data (Step 2)

**User Action:**
- User approves the transaction.
- Once confirmed, the app automatically begins uploading chunks.

**Technical Process (The Loop):**
The app enters a `while` loop to process chunks sequentially (`startChunkUploads`).

1.  **Preparation:** 
    - It identifies the next chunk index `V`.
    - It waits **3000ms** (3s) to allow the wallet's nonce to propagate.
2.  **Wallet Prompt:** Triggers `add-chunk`.
    - **Arguments:** `(root_hash, chunk_index, chunk_data)`
    - *Note:* If "Safe Mode" is OFF (default), the user must manually sign this in the wallet popup.
3.  **Submission:** 
    - The transaction is broadcast.
    - *UI Update:* "Part X - Sent".
4.  **Verification (Safe Mode Only):**
    - If Safe Mode is ON, the app polls the API until the transaction confirms.
    - If Safe Mode is OFF, it assumes success and moves to the next chunk immediately (after the 3s delay).
5.  **Error Handling (Resume):**
    - If the user closes the wallet popup or the browser blocks it:
        - The loop pauses.
        - A **"Retry / Resume Part X"** button appears.
        - *Intention:* Prevents the whole process from crashing due to a single missed click.

## 4. Sealing & Finalization (Step 3)

**User Action:**
- After the last chunk is uploaded, the app automatically moves to the final step.

**Technical Process:**
1.  **Buffer Delay:** The app displays "Waiting for wallet to catch up..." and waits **3 seconds**.
    - *Intention:* Ensures the node has processed the last `add-chunk` transaction nonce before receiving the `seal` transaction.
2.  **Wallet Prompt:** Triggers `seal-inscription`.
    - **Arguments:** `(root_hash)`
3.  **UI Update (Immediate):**
    - As soon as the transaction is broadcast:
        - The "Begin Inscription" button is hidden (preventing double-clicks).
        - A "Seal TX Sent" message with a Hiro Explorer link is shown.
4.  **Polling:** The app polls `/extended/v1/tx/{txid}?_t={timestamp}` for confirmation.
    - *Status:* "Waiting for confirmation..." -> "Confirmed!" (Green).
5.  **Finalizing:**
    - Displays "Finalizing state (waiting 2s)...".
    - *Intention:* Wait for the smart contract event to be indexed so we can read the new ID.
6.  **ID Parsing:**
    - The app inspects the transaction result: `(ok u123)`.
    - Extracts the ID (`123`).

## 5. Completion

**User Action:**
- User sees "🎉 Inscription #123 Complete!".
- User clicks **"View Inscription"**.

**Technical Process:**
1.  **State Update:** `lastSealedRoot` is set to the current file hash.
2.  **Gallery Refresh:** 
    - `inscriptionMetaCache` is cleared.
    - The gallery navigates to the page containing the new ID.
3.  **Playback:** The "View" button loads the newly inscribed data from the chain and plays/displays it.

---

**Key Security & Stability Features:**
- **Proxy:** All API calls go through `/hiro-proxy/` to hide the API Key.
- **Cache Busting:** `_t={timestamp}` is added to TX checks to prevent "hanging" on stale status.
- **Nonce Protection:** 3s delays between chunks prevents "out of order" errors.
