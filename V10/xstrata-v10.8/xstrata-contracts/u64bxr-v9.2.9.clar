;; u64bxr-v9.2.9: xStrata Optimized Protocol (SVG Embedded)
;; Features: Sequential Hash Chaining, Batching, Embedded SVG Token URI
;; Note: SIP-009 Trait is commented out due to extended URI length (>256 chars)

;; --- TRAIT DEFINITIONS ---
;; (use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
;; (impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
(define-constant MAX-BATCH-SIZE u50) 

;; --- ROYALTY CONSTANTS (microSTX) ---
(define-constant ROYALTY-BEGIN u100000)
(define-constant ROYALTY-SEAL-BASE u100000)
(define-constant ROYALTY-SEAL-PER-CHUNK u10000)

;; --- EMBEDDED MEDIA ---
(define-constant SVG-BODY "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><circle cx='25' cy='25' r='20' fill='none' stroke='#6366f1' stroke-width='4' stroke-dasharray='80' stroke-dashoffset='20'><animateTransform attributeName='transform' type='rotate' from='0 25 25' to='360 25 25' dur='1s' repeatCount='indefinite' /></circle><circle cx='25' cy='25' r='12' fill='none' stroke='#ec4899' stroke-width='4' stroke-dasharray='50' stroke-dashoffset='20'><animateTransform attributeName='transform' type='rotate' from='360 25 25' to='0 25 25' dur='1.5s' repeatCount='indefinite' /></circle></svg>")
(define-constant SVG-PREFIX "data:image/svg+xml;utf8,")

;; --- DATA VARS ---
(define-data-var next-id uint u0)
(define-data-var royalty-recipient principal tx-sender)

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

;; Dependency Graph (On-chain linking of assets)
(define-map InscriptionDependencies uint (list 50 uint))

;; Upload State Tracker
(define-map UploadState 
    {
        owner: principal,
        hash: (buff 32)
    }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        total-chunks: uint,
        current-index: uint,
        running-hash: (buff 32)
    }
)

;; The Data Store
(define-map Chunks { context: (buff 32), index: uint } (buff 16384))

;; --- SIP-009-LIKE FUNCTIONS ---

(define-read-only (get-last-token-id)
    (ok (- (var-get next-id) u1)))

;; Modified to return embedded SVG as Data URI
;; Return type expanded to (string-ascii 1024) to accommodate the SVG
(define-read-only (get-token-uri (id uint))
    (if (is-some (nft-get-owner? xstrata-inscription id))
        (ok (some (concat SVG-PREFIX SVG-BODY)))
        (ok none)
    )
)

(define-read-only (get-owner (id uint))
    (ok (nft-get-owner? xstrata-inscription id)))

(define-public (transfer (id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
        (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-NOT-AUTHORIZED)
        
        (try! (nft-transfer? xstrata-inscription id sender recipient))
        
        (match (map-get? InscriptionMeta id)
            meta (map-set InscriptionMeta id (merge meta { owner: recipient }))
            true
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

;; --- CORE LOGIC ---

(define-public (begin-inscription (expected-hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (total-chunks uint))
    (begin
        (asserts! (is-none (map-get? UploadState { owner: tx-sender, hash: expected-hash })) ERR-ALREADY-SEALED)

        (if (> ROYALTY-BEGIN u0)
            (if (is-eq tx-sender (var-get royalty-recipient))
                true
                (try! (stx-transfer? ROYALTY-BEGIN tx-sender (var-get royalty-recipient)))
            )
            true
        )
        
        (map-insert UploadState 
            { owner: tx-sender, hash: expected-hash }
            {
                mime-type: mime,
                total-size: total-size,
                total-chunks: total-chunks,
                current-index: u0,
                running-hash: 0x0000000000000000000000000000000000000000000000000000000000000000
            }
        )
        (ok true)
    )
)

(define-public (add-chunk-batch (hash (buff 32)) (chunks (list 50 (buff 16384))))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: hash }) ERR-NOT-FOUND))
        (start-idx (get current-index state))
        (start-hash (get running-hash state))
    )
        (let ((result (fold process-chunk chunks 
            {
                idx: start-idx, 
                run-hash: start-hash, 
                target-hash: hash 
            })))
            
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

(define-private (process-chunk (data (buff 16384)) (ctx { idx: uint, run-hash: (buff 32), target-hash: (buff 32) }))
    (let (
        (current-idx (get idx ctx))
        (current-hash (get run-hash ctx))
        (target-hash (get target-hash ctx))
        (next-hash (sha256 (concat current-hash data)))
    )
        (map-set Chunks { context: target-hash, index: current-idx } data)
        
        {
            idx: (+ current-idx u1), 
            run-hash: next-hash, 
            target-hash: target-hash 
        }
    )
)

;; --- SEALING HELPERS ---

(define-private (seal-internal (expected-hash (buff 32)) (new-id uint))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: expected-hash }) ERR-NOT-FOUND))
        (final-hash (get running-hash state))
        (chunks (get total-chunks state))
        (seal-royalty (+ ROYALTY-SEAL-BASE (* ROYALTY-SEAL-PER-CHUNK chunks)))
    )
        (asserts! (is-eq final-hash expected-hash) ERR-HASH-MISMATCH)

        (if (> seal-royalty u0)
            (if (is-eq tx-sender (var-get royalty-recipient))
                true
                (try! (stx-transfer? seal-royalty tx-sender (var-get royalty-recipient)))
            )
            true
        )
        
        (try! (nft-mint? xstrata-inscription new-id tx-sender))
        
        (map-insert InscriptionMeta new-id {
            owner: tx-sender,
            mime-type: (get mime-type state),
            total-size: (get total-size state),
            sealed: true,
            final-hash: final-hash
        })
        ;; TokenURI map write removed in favor of embedded SVG
        
        (map-delete UploadState { owner: tx-sender, hash: expected-hash })
        
        (var-set next-id (+ new-id u1))
        (ok new-id)
    )
)

;; 3. SEAL STANDARD: Finalize and Mint
;; Note: token-uri-string argument retained for API compatibility but ignored
(define-public (seal-inscription (expected-hash (buff 32)) (token-uri-string (string-ascii 256)))
    (seal-internal expected-hash (var-get next-id))
)

;; 4. SEAL RECURSIVE: Finalize with Dependencies
(define-public (seal-recursive (expected-hash (buff 32)) (token-uri-string (string-ascii 256)) (dependencies (list 50 uint)))
    (let ((id (var-get next-id)))
        (map-insert InscriptionDependencies id dependencies)
        (seal-internal expected-hash id)
    )
)

;; --- READERS ---

(define-read-only (get-inscription-meta (id uint))
    (map-get? InscriptionMeta id)
)

(define-read-only (get-chunk (id uint) (index uint))
    (let ((meta (unwrap! (map-get? InscriptionMeta id) none)))
        (map-get? Chunks { context: (get final-hash meta), index: index })
    )
)

(define-read-only (get-dependencies (id uint))
    (default-to (list) (map-get? InscriptionDependencies id))
)

(define-read-only (get-upload-state (expected-hash (buff 32)) (owner principal))
    (map-get? UploadState { owner: owner, hash: expected-hash })
)

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index })
)
