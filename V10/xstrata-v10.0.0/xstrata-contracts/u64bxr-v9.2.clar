;; u64bxr-v9.2: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait .sip009-nft-trait.nft-trait)
(impl-trait .sip009-nft-trait.nft-trait)

;; --- ASSET DEFINITION ---
(define-non-fungible-token xstrata-inscription uint)

;; --- ERROR CODES ---
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-FOUND (err u101))
(define-constant ERR-INVALID-BATCH (err u102))
(define-constant ERR-HASH-MISMATCH (err u103))
(define-constant ERR-ALREADY-SEALED (err u104))
(define-constant ERR-METADATA-FROZEN (err u105))
(define-constant ERR-WRONG-INDEX (err u106))

;; --- CONSTANTS ---
(define-constant CONTRACT-OWNER tx-sender)
;; Reduced batch size to ensure TX stays under 1MB payload limits
(define-constant MAX-BATCH-SIZE u15) 

;; --- DATA VARS ---
(define-data-var next-id uint u0)
(define-data-var royalty-recipient principal tx-sender)
(define-data-var royalty-fee-per-chunk uint u1000)

;; --- STORAGE ---

;; Core Inscription Metadata
(define-map InscriptionMeta uint 
    {
        owner: principal,
        mime-type: (string-ascii 64),
        total-size: uint,
        sealed: bool,
        final-hash: (buff 32)
    }
)

;; URI Map for SIP-009 Compliance
(define-map TokenURIs uint (string-ascii 256))

;; Dependency Graph (On-chain linking of assets)
(define-map InscriptionDependencies uint (list 50 uint))

;; Upload State Tracker (Keyed by Owner + Expected Hash)
;; Tracks the progress of a streaming upload
(define-map UploadState 
    { owner: principal, hash: (buff 32) }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        current-index: uint,
        running-hash: (buff 32)
    }
)

;; The Data Store
;; Keyed by Content Hash (Context) to allow deduplication across different NFTs
(define-map Chunks { context: (buff 32), index: uint } (buff 65536))

;; --- SIP-009 FUNCTIONS ---

(define-read-only (get-last-token-id)
    (ok (- (var-get next-id) u1)))

(define-read-only (get-token-uri (id uint))
    (ok (map-get? TokenURIs id)))

(define-read-only (get-owner (id uint))
    (ok (nft-get-owner? xstrata-inscription id)))

(define-public (transfer (id uint) (sender principal) (recipient principal))
    (begin
        ;; Strict SIP-009 check: only the sender (owner) can transfer
        (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
        (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-NOT-AUTHORIZED)
        
        (try! (nft-transfer? xstrata-inscription id sender recipient))
        
        ;; Update metadata owner record for easier indexing
        (match (map-get? InscriptionMeta id)
            meta (map-set InscriptionMeta id (merge meta { owner: recipient }))
            true ;; ignore if meta missing
        )
        (ok true)
    )
)

;; --- ADMIN FUNCTIONS ---

(define-public (set-royalty-recipient (recipient principal))
    (begin
        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
        (var-set royalty-recipient recipient)
        (ok true)
    )
)

(define-public (set-royalty-fee (fee uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
        (var-set royalty-fee-per-chunk fee)
        (ok true)
    )
)

;; --- CORE LOGIC ---

;; 1. BEGIN: Initialize the upload session
;; We define the "Expected Hash" upfront. The upload is only valid if the data matches this hash.
(define-public (begin-inscription (expected-hash (buff 32)) (mime (string-ascii 64)) (total-size uint))
    (begin
        ;; If an upload state already exists, we don't overwrite it to prevent griefing progress
        (asserts! (is-none (map-get? UploadState { owner: tx-sender, hash: expected-hash })) ERR-ALREADY-SEALED)
        
        (map-insert UploadState 
            { owner: tx-sender, hash: expected-hash }
            {
                mime-type: mime,
                total-size: total-size,
                current-index: u0,
                running-hash: 0x0000000000000000000000000000000000000000000000000000000000000000 ;; Seed hash
            }
        )
        (ok true)
    )
)

;; 2. BATCH ADD: Process multiple chunks efficiently
;; Uses Fold to iterate through a list of chunks, updating the running hash and storing data.
(define-public (add-chunk-batch (hash (buff 32)) (chunks (list 15 (buff 65536))))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: hash }) ERR-NOT-FOUND))
        (start-idx (get current-index state))
        (start-hash (get running-hash state))
        (batch-size (len chunks))
    )
        ;; 1. Calculate and Transfer Royalties for the whole batch
        (if (> (var-get royalty-fee-per-chunk) u0)
            (try! (stx-transfer? (* (var-get royalty-fee-per-chunk) batch-size) tx-sender (var-get royalty-recipient)))
            true
        )

        ;; 2. Process chunks
        ;; fold iterates over `chunks`. We pass an accumulator context to track index and hash.
        (let ((result (fold process-chunk chunks 
            { 
                idx: start-idx, 
                run-hash: start-hash, 
                target-hash: hash 
            })))
            
            ;; 3. Update the global state with new index and new running hash
            (map-set UploadState 
                { owner: tx-sender, hash: hash }
                (merge state { 
                    current-index: (get idx result), 
                    running-hash: (get run-hash result) 
                })
            )
            (ok true)
        )
    )
)

;; Helper for Batch Fold
;; Private function to store data and compute next hash in chain
(define-private (process-chunk (data (buff 65536)) (ctx { idx: uint, run-hash: (buff 32), target-hash: (buff 32) }))
    (let (
        (current-idx (get idx ctx))
        (current-hash (get run-hash ctx))
        (target-hash (get target-hash ctx))
        
        ;; SEQUENTIAL HASHING: Next = sha256(CurrentHash + Data)
        ;; This enforces strict ordering of chunks.
        (next-hash (sha256 (concat current-hash data)))
    )
        ;; Store the chunk. We use `target-hash` (the final expected hash) as the Context ID.
        ;; This allows deduplication: if two people upload the same file, they share the chunk storage.
        (map-set Chunks { context: target-hash, index: current-idx } data)
        
        ;; Return updated context for next iteration
        { 
            idx: (+ current-idx u1), 
            run-hash: next-hash, 
            target-hash: target-hash 
        }
    )
)

;; --- SEALING HELPERS ---

(define-private (seal-internal (expected-hash (buff 32)) (token-uri-string (string-ascii 256)) (new-id uint))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: expected-hash }) ERR-NOT-FOUND))
        (final-hash (get running-hash state))
    )
        ;; VERIFY INTEGRITY: The running hash chain must match the expected hash provided at start.
        (asserts! (is-eq final-hash expected-hash) ERR-HASH-MISMATCH)
        
        ;; Mint NFT
        (try! (nft-mint? xstrata-inscription new-id tx-sender))
        
        ;; Set Metadata
        (map-insert InscriptionMeta new-id {
            owner: tx-sender,
            mime-type: (get mime-type state),
            total-size: (get total-size state),
            sealed: true,
            final-hash: final-hash
        })
        (map-set TokenURIs new-id token-uri-string)
        
        ;; Clean up state to free memory (optional but good practice)
        (map-delete UploadState { owner: tx-sender, hash: expected-hash })
        
        ;; Increment ID
        (var-set next-id (+ new-id u1))
        (ok new-id)
    )
)

;; 3. SEAL STANDARD: Finalize and Mint
(define-public (seal-inscription (expected-hash (buff 32)) (token-uri-string (string-ascii 256)))
    (seal-internal expected-hash token-uri-string (var-get next-id))
)

;; 4. SEAL RECURSIVE: Finalize with Dependencies
;; Links this new inscription to existing ones (e.g., an HTML file referencing JS/CSS inscriptions)
(define-public (seal-recursive (expected-hash (buff 32)) (token-uri-string (string-ascii 256)) (dependencies (list 50 uint)))
    (let ((id (var-get next-id)))
        (map-insert InscriptionDependencies id dependencies)
        (seal-internal expected-hash token-uri-string id)
    )
)

;; --- READERS ---

(define-read-only (get-inscription-meta (id uint))
    (map-get? InscriptionMeta id)
)

(define-read-only (get-chunk (id uint) (index uint))
    (let ((meta (unwrap! (map-get? InscriptionMeta id) none)))
        ;; Look up chunk using the finalized hash from metadata
        (map-get? Chunks { context: (get final-hash meta), index: index })
    )
)

(define-read-only (get-dependencies (id uint))
    (default-to (list) (map-get? InscriptionDependencies id))
)

;; --- STATE READERS (For Resume/Retry) ---

(define-read-only (get-upload-state (expected-hash (buff 32)) (owner principal))
    (map-get? UploadState { owner: owner, hash: expected-hash })
)

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index })
)