;; --- TRAIT DEFINITIONS ---

;; [DEVNET / CLARINET] - USE THIS FOR CONSOLE TESTING
(impl-trait .sip009-nft-trait.nft-trait)
(use-trait nft-trait .sip009-nft-trait.nft-trait)

;; [TESTNET]
;; (impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
;; (use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

;; [MAINNET] - COMMENT THIS OUT FOR LOCAL TESTING
;; (impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
;; (use-trait nft-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-non-fungible-token xstrata-inscription uint)

;; --- ERROR CODES ---
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant ERR-INVALID-META (err u104))
(define-constant ERR-NOT-COMPLETE (err u105))
(define-constant ERR-INVALID-PROOF (err u106))
(define-constant ERR-NOT-OWNER (err u107))

;; --- CONFIGURATION ---
(define-constant MAX-CHUNK-SIZE u65536) ;; 64KB
(define-constant MAX-CHUNK-COUNT u1024)

;; --- OWNERSHIP & ROYALTIES ---
(define-constant CONTRACT-OWNER tx-sender) 
(define-data-var royalty-recipient principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X) 
(define-data-var royalty-fee-per-chunk uint u10000) ;; 0.01 STX per chunk
(define-data-var token-uri (string-ascii 256) "data:application/json;base64,eyJuYW1lIjoieFN0cmF0YSJ9")
(define-data-var next-id uint u0)

;; --- STORAGE MAPS ---

;; Metadata for sealed inscriptions
(define-map Inscriptions
    uint 
    {
        owner: principal,
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        merkle-root: (buff 32)
    }
)

;; Dependency Graph (Recursive pointers)
(define-map InscriptionDependencies uint (list 10 uint))

;; Temporary storage for uploads
(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        received-count: uint
    }
)

;; Global Data Store (De-duplicated by Hash)
(define-map Chunks { hash: (buff 32), index: uint } (buff 65536))

;; --- MARKETPLACE APPROVALS ---
(define-map TokenApprovals uint principal)
(define-map OperatorApprovals { owner: principal, operator: principal } bool)

;; --- SIP-009 FUNCTIONS ---

(define-read-only (get-last-token-id)
    (ok (- (var-get next-id) u1)))

(define-read-only (get-token-uri (id uint))
    (ok (some (var-get token-uri))))

(define-read-only (get-owner (id uint))
    (ok (nft-get-owner? xstrata-inscription id)))

(define-public (transfer (id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-NOT-OWNER)
        (asserts! (or (is-eq tx-sender sender) (is-approved sender id)) ERR-NOT-AUTHORIZED)
        (try! (nft-transfer? xstrata-inscription id sender recipient))
        (map-delete TokenApprovals id)
        (ok true)))

;; --- APPROVAL FUNCTIONS ---

(define-read-only (is-approved (owner principal) (id uint))
    (or 
        (is-eq (map-get? TokenApprovals id) (some tx-sender))
        (default-to false (map-get? OperatorApprovals { owner: owner, operator: tx-sender }))
    ))

(define-public (set-approved (id uint) (operator principal) (approved bool))
    (begin
        (asserts! (is-eq (some tx-sender) (nft-get-owner? xstrata-inscription id)) ERR-NOT-OWNER)
        (if approved
            (map-set TokenApprovals id operator)
            (map-delete TokenApprovals id))
        (ok true)))

(define-public (set-approved-all (operator principal) (approved bool))
    (begin
        (map-set OperatorApprovals { owner: tx-sender, operator: operator } approved)
        (ok true)))

;; --- ADMIN ---

(define-private (assert-contract-owner)
    (if (is-eq tx-sender CONTRACT-OWNER) (ok true) ERR-NOT-AUTHORIZED))

(define-public (set-royalty-recipient (recipient principal))
    (begin (try! (assert-contract-owner)) (var-set royalty-recipient recipient) (ok true)))

(define-public (set-royalty-fee-per-chunk (fee uint))
    (begin (try! (assert-contract-owner)) (var-set royalty-fee-per-chunk fee) (ok true)))

;; --- MERKLE HELPERS ---

(define-private (hash-pair (left (buff 32)) (right (buff 32)))
    (sha256 (concat left right)))

(define-private (apply-proof-step (step (tuple (hash (buff 32)) (is-left bool))) (acc (buff 32)))
    (if (get is-left step) (hash-pair (get hash step) acc) (hash-pair acc (get hash step))))

(define-private (verify-proof (root (buff 32)) (leaf (buff 32)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    (is-eq (fold apply-proof-step proof leaf) root))

;; --- CORE LOGIC ---

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (let ((pending (map-get? PendingInscriptions { hash: hash, owner: tx-sender })))
        (if (is-some pending)
            (ok true) 
            (begin
                (asserts! (and (> chunk-count u0) (<= chunk-count MAX-CHUNK-COUNT)) ERR-INVALID-META)
                (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
                    mime-type: mime, total-size: total-size, chunk-count: chunk-count, received-count: u0
                })
                (ok true)))))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 65536)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    (let (
        (pending-key { hash: hash, owner: tx-sender })
        (meta (unwrap! (map-get? PendingInscriptions pending-key) ERR-NOT-FOUND))
        (chunk-key { hash: hash, index: index })
        (chunk-exists (is-some (map-get? Chunks chunk-key)))
    )
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (if (not chunk-exists)
            (begin
                (asserts! (verify-proof hash (sha256 data) proof) ERR-INVALID-PROOF)
                (map-set Chunks chunk-key data)
            )
            true 
        )
        (map-set PendingInscriptions pending-key (merge meta { received-count: (+ (get received-count meta) u1) }))
        (ok true)))

;; --- SEALING ---

(define-private (seal-internal (hash (buff 32)) (id uint) (meta { mime-type: (string-ascii 64), total-size: uint, chunk-count: uint, received-count: uint }))
    (begin
        (asserts! (is-eq (get received-count meta) (get chunk-count meta)) ERR-NOT-COMPLETE)
        
        ;; Bulk Fee Collection
        (let ((total-fee (* (var-get royalty-fee-per-chunk) (get chunk-count meta))))
            (if (> total-fee u0)
                (try! (stx-transfer? total-fee tx-sender (var-get royalty-recipient)))
                true
            )
        )

        (try! (nft-mint? xstrata-inscription id tx-sender))

        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            merkle-root: hash
        })

        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (seal-internal hash (var-get next-id) meta)))

(define-public (seal-recursive (hash (buff 32)) (dependencies (list 10 uint)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert InscriptionDependencies id dependencies)
        (seal-internal hash id meta)))

;; --- READERS ---

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta m 
            (map-get? Chunks { hash: (get merkle-root m), index: index }) 
            none)))

(define-read-only (get-dependencies (id uint))
    (default-to (list) (map-get? InscriptionDependencies id)))