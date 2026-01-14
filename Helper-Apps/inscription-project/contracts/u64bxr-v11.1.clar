;; u64bxr-sequential-v2: xStrata High-Throughput Protocol
;; Status: Patched (Missing Error Fixed)

;; --- TRAIT DEFINITIONS ---
;; [DEVNET / CLARINET]
(impl-trait .sip009-nft-trait.nft-trait)
(use-trait nft-trait .sip009-nft-trait.nft-trait)

(define-non-fungible-token xstrata-inscription uint)

;; --- ERROR CODES ---
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-WRONG-INDEX (err u103))
(define-constant ERR-HASH-MISMATCH (err u104))
(define-constant ERR-NOT-COMPLETE (err u105))
(define-constant ERR-NOT-OWNER (err u107))
(define-constant ERR-INVALID-META (err u108)) ;; <--- FIXED: Added this missing code

;; --- CONFIGURATION ---
(define-constant MAX-CHUNK-SIZE u16384) 
(define-constant MAX-CHUNK-COUNT u4096)

;; --- OWNERSHIP & ROYALTIES ---
(define-constant CONTRACT-OWNER tx-sender) 
(define-data-var royalty-recipient principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X) 
(define-data-var royalty-fee-per-chunk uint u10000) 
(define-data-var base-uri (string-ascii 210) "https://api.xstrata.io/metadata/")
(define-data-var next-id uint u0)

;; --- STORAGE MAPS ---

(define-map Inscriptions
    uint 
    {
        owner: principal,
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        final-hash: (buff 32)
    }
)

(define-map InscriptionDependencies uint (list 200 uint))

(define-map PendingInscriptions
    uint 
    {
        owner: principal,
        expected-hash: (buff 32),
        current-hash: (buff 32),
        current-index: uint,
        chunk-count: uint,
        mime-type: (string-ascii 64),
        total-size: uint
    }
)

(define-map Chunks { id: uint, index: uint } (buff 16384))

;; --- MARKETPLACE APPROVALS ---
(define-map TokenApprovals uint principal)
(define-map OperatorApprovals { owner: principal, operator: principal } bool)

;; --- SIP-009 FUNCTIONS ---

(define-read-only (get-last-token-id)
    (ok (- (var-get next-id) u1)))

(define-read-only (get-token-uri (id uint))
    (ok (some (var-get base-uri))))

(define-read-only (get-owner (id uint))
    (ok (nft-get-owner? xstrata-inscription id)))

(define-public (transfer (id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-NOT-OWNER)
        (asserts! (or (is-eq contract-caller sender) (is-approved sender id)) ERR-NOT-AUTHORIZED)
        (try! (nft-transfer? xstrata-inscription id sender recipient))
        (map-delete TokenApprovals id)
        (ok true)))

(define-read-only (is-approved (owner principal) (id uint))
    (or 
        (is-eq (map-get? TokenApprovals id) (some contract-caller))
        (default-to false (map-get? OperatorApprovals { owner: owner, operator: contract-caller }))
    ))

(define-public (set-approved (id uint) (operator principal) (approved bool))
    (begin
        (asserts! (is-eq (some contract-caller) (nft-get-owner? xstrata-inscription id)) ERR-NOT-OWNER)
        (if approved
            (map-set TokenApprovals id operator)
            (map-delete TokenApprovals id))
        (ok true)))

(define-public (set-approved-all (operator principal) (approved bool))
    (begin
        (map-set OperatorApprovals { owner: contract-caller, operator: operator } approved)
        (ok true)))

;; --- ADMIN ---

(define-private (assert-contract-owner)
    (if (is-eq contract-caller CONTRACT-OWNER) (ok true) ERR-NOT-AUTHORIZED))

(define-public (set-royalty-recipient (recipient principal))
    (begin (try! (assert-contract-owner)) (var-set royalty-recipient recipient) (ok true)))

(define-public (set-royalty-fee-per-chunk (fee uint))
    (begin (try! (assert-contract-owner)) (var-set royalty-fee-per-chunk fee) (ok true)))

;; --- CORE LOGIC ---

(define-public (begin-inscription (expected-hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (let ((id (var-get next-id)))
        (asserts! (and (> chunk-count u0) (<= chunk-count MAX-CHUNK-COUNT)) ERR-INVALID-META)
        
        (map-set PendingInscriptions id {
            owner: contract-caller,
            expected-hash: expected-hash,
            current-hash: 0x, 
            current-index: u0,
            chunk-count: chunk-count,
            mime-type: mime,
            total-size: total-size
        })
        
        (var-set next-id (+ id u1))
        (ok id)))

(define-public (add-chunk (id uint) (data (buff 16384)))
    (let (
        (meta (unwrap! (map-get? PendingInscriptions id) ERR-NOT-FOUND))
        (next-idx (get current-index meta))
        (new-hash (sha256 (concat (get current-hash meta) data)))
    )
        (asserts! (is-eq (get owner meta) contract-caller) ERR-NOT-AUTHORIZED)
        (asserts! (< next-idx (get chunk-count meta)) ERR-WRONG-INDEX)
        
        (map-set Chunks { id: id, index: next-idx } data)
        
        (map-set PendingInscriptions id (merge meta { 
            current-index: (+ next-idx u1),
            current-hash: new-hash
        }))
        (ok true)))

(define-public (add-chunk-batch (id uint) (chunks (list 20 (buff 16384))))
    (fold batch-step chunks (ok id)))

(define-private (batch-step (data (buff 16384)) (result (response uint uint)))
    (match result
        id (begin 
            (try! (add-chunk id data)) 
            (ok id))
        err result))

(define-public (seal-inscription (id uint))
    (let ((meta (unwrap! (map-get? PendingInscriptions id) ERR-NOT-FOUND)))
        (asserts! (is-eq (get current-index meta) (get chunk-count meta)) ERR-NOT-COMPLETE)
        (asserts! (is-eq (get current-hash meta) (get expected-hash meta)) ERR-HASH-MISMATCH)
        
        (let ((total-fee (* (var-get royalty-fee-per-chunk) (get chunk-count meta))))
            (if (> total-fee u0)
                (try! (stx-transfer? total-fee contract-caller (var-get royalty-recipient)))
                true
            )
        )

        (try! (nft-mint? xstrata-inscription id contract-caller))

        (map-insert Inscriptions id {
            owner: contract-caller,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            final-hash: (get expected-hash meta)
        })

        (map-delete PendingInscriptions id)
        (ok id)))

(define-public (seal-recursive (id uint) (dependencies (list 200 uint)))
    (begin 
        (map-insert InscriptionDependencies id dependencies)
        (seal-inscription id)))

;; --- READERS ---

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (map-get? Chunks { id: id, index: index }))

(define-read-only (get-dependencies (id uint))
    (default-to (list) (map-get? InscriptionDependencies id)))