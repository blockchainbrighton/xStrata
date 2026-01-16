# XStrata Inscription Process - Technical Walkthrough (current)

This document describes the current minting flow as implemented in
`assets/core/index.js` and the UI in `index.html`.

## 1. Preparation & File Selection

**User Action:**
- User selects or drops a file.

**Technical Process:**
1. **File Reading:** The browser reads the file into an `ArrayBuffer`.
2. **Chunking:** Chunk size is read from `#chunk-size-select` (hidden by default).
   - Default value is **16 KB** (16384) in the UI.
   - `getSelectedChunkSize()` falls back to 16 KB if the select is missing.
   - v9.2.6 forces 16 KB chunks to keep 20‑chunk batches under type limits.
3. **Root Calculation:** The hash strategy depends on contract mode:
   - **Legacy/Batch/BatchX/BatchXR/V6:** Merkle root of chunk hashes.
   - **V9/V9.2 modes:** Sequential hash over chunks (non-Merkle).
4. **Duplicate Check:** If `lastSealedRoot` matches the current root in-session,
   minting is blocked to prevent duplicates.
5. **Pending Check:** The app calls `get-pending-inscription` or `get-upload-state`
   (v9 modes) to detect an in-progress inscription. If found, the UI switches to
   "Resume" mode.

## 2. Initialization (Step 1)

**User Action:**
- Click **Begin Inscription** (or **Resume Inscription** if pending exists).

**Technical Process:**
1. **Wallet Prompt:** `begin-inscription` is submitted only for a fresh inscription.
2. **Pending Metadata:** Contract stores metadata in `PendingInscriptions`.
3. **Polling:** The app waits for the transaction to confirm before uploading chunks.
   - Hiro API calls are proxied through `/hiro-proxy/` with cache-busting.

## 3. Uploading Data (Step 2)

**User Action:**
- Approve each transaction in the wallet.

**Technical Process:**
1. **Chunk Loop:** `startChunkUploads` sequentially submits chunk transactions.
2. **Batch Mode:** If batch mode is enabled, `add-chunk-batch` uploads multiple
   chunks per tx; otherwise `add-chunk` is used.
3. **Safe Mode:** When enabled, each tx is polled for confirmation before
   proceeding; otherwise the app continues after a short delay.
   - Sequential modes also confirm progress by polling on-chain upload state
     (`get-upload-state`) to avoid stalls if tx polling lags.
4. **Resume Logic:** If a pending inscription exists, the app scans for missing
   chunks via `get-pending-chunk` and uploads only missing parts.
5. **Error Handling:** Wallet cancels trigger auto-retry up to a fixed limit, then
   a manual "Retry / Resume" button appears.

## 4. Sealing & Finalization (Step 3)

**User Action:**
- After the last chunk is uploaded, the app seals automatically.

**Technical Process:**
1. **Buffer Delay:** A short wait is added to avoid nonce ordering issues.
2. **Wallet Prompt:** `seal-inscription` is submitted.
3. **Confirmation:** The app polls for confirmation, with a pending-state fallback.
4. **ID Resolution:** The tx result is parsed to extract `(ok uN)` and set the new
   inscription ID; if missing, a fallback scan searches recent IDs by root.

## 5. Completion

**User Action:**
- User views the new inscription in the gallery/viewer.

**Technical Process:**
1. `lastSealedRoot` is updated.
2. Gallery cache is cleared and the viewer navigates to the new ID.

---

## Key stability features
- **Proxying:** All Hiro API calls are rewritten to `/hiro-proxy/` and cached
  requests are cache-busted.
- **Nonce safety:** Delays between uploads reduce nonce ordering errors.
- **Auth diagnostics:** Optional verbose auth logging captures wallet/provider state.
