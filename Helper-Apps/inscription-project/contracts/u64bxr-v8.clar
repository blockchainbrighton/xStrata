;; u64bxr-v8: XStrata Recursive Protocol
;; Features: SIP-009, SIP-016, BatchXR, On-Chain Dependency Graph

;; SIP-009 Trait Implementation
;; --- TOGGLE FOR DEPLOYMENT ---
;; LOCAL/CLARINET: .sip009-nft-trait.nft-trait
;; TESTNET: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait
;; MAINNET: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait
(use-trait nft-trait .sip009-nft-trait.nft-trait)
(impl-trait .sip009-nft-trait.nft-trait)

(define-non-fungible-token xstrata-inscription uint)

;; --- ERROR CODES ---
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant ERR-INVALID-META (err u104))
(define-constant ERR-NOT-COMPLETE (err u105))
(define-constant ERR-INVALID-PROOF (err u106))
(define-constant ERR-SENDER-NOT-OWNER (err u107))

;; --- CONFIGURATION ---
(define-constant MAX-CHUNK-SIZE u65536)
(define-constant MAX-BATCH-SIZE u10)
(define-constant MAX-CHUNK-COUNT u1024)
(define-constant MAX-TOTAL-SIZE u67108864)
(define-constant MAX-PROOF-LEN u32)

;; --- OWNERSHIP & ROYALTIES ---
(define-constant CONTRACT-OWNER tx-sender) 
(define-data-var royalty-recipient principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X) 
(define-data-var royalty-fee-per-chunk uint u10000) 
(define-data-var token-uri (string-ascii 256) "data:application/json;base64,eyJuYW1lIjoieFN0cmF0YSIsImltYWdlIjoiZGF0YTppbWFnZS9zdmcreG1sLDxzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB2aWV3Qm94PScwIDAgMTAgMTAnPjxjaXJjbGUgY3g9JzUnIGN5PSc1JyByPSc0JyBmaWxsPSclMjM0MDgwRkYnLz48L3N2Zz4ifQ==")
(define-data-var collection-cover-id (optional uint) none)
(define-data-var next-id uint u0)

;; --- STORAGE MAPS ---
(define-map Inscriptions
    uint 
    {
        owner: principal,
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        sealed: bool,
        merkle-root: (buff 32),
        data-hash: (buff 32)
    }
)

;; NEW: Dependency Graph (Inscription ID -> List of required IDs)
(define-map InscriptionDependencies uint (list 10 uint))

(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        context: (buff 32),
        received-count: uint
    }
)

(define-map Chunks { context: (buff 32), index: uint } (buff 65536))

;; --- SIP-009 FUNCTIONS ---
(define-read-only (get-last-token-id)
    (ok (- (var-get next-id) u1)))

(define-read-only (get-token-uri (id uint))
    (ok (some (var-get token-uri))))

(define-read-only (get-owner (id uint))
    (ok (nft-get-owner? xstrata-inscription id)))

;; --- SIP-016 Contract Metadata ---
(define-public (get-contract-metadata)
  (ok (some "https://your-domain.com/collection.json")))

(define-public (transfer (id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
        (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-SENDER-NOT-OWNER)
        (let ((inscription (unwrap! (map-get? Inscriptions id) ERR-NOT-FOUND)))
            (try! (nft-transfer? xstrata-inscription id sender recipient))
            (map-set Inscriptions id (merge inscription { owner: recipient }))
            (ok true))))

;; --- ADMIN ---
(define-private (assert-owner)
    (if (is-eq tx-sender CONTRACT-OWNER) (ok true) ERR-NOT-AUTHORIZED))

(define-public (set-royalty-recipient (recipient principal))
    (begin (try! (assert-owner)) (var-set royalty-recipient recipient) (ok true)))

(define-public (set-royalty-fee-per-chunk (fee uint))
    (begin (try! (assert-owner)) (var-set royalty-fee-per-chunk fee) (ok true)))

;; --- MERKLE HELPERS ---
(define-private (hash-pair (left (buff 32)) (right (buff 32)))
    (sha256 (concat left right)))

(define-private (chunk-size-valid? (index uint) (chunk-count uint) (total-size uint) (data (buff 65536)))
    (let ((last-index (- chunk-count u1))
          (expected-last (- total-size (* last-index MAX-CHUNK-SIZE))))
        (if (< index last-index)
            (is-eq (len data) MAX-CHUNK-SIZE)
            (is-eq (len data) expected-last))))

(define-private (apply-proof-step (step (tuple (hash (buff 32)) (is-left bool))) (acc (buff 32)))
    (if (get is-left step) (hash-pair (get hash step) acc) (hash-pair acc (get hash step))))

(define-private (verify-proof (root (buff 32)) (leaf (buff 32)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    (is-eq (fold apply-proof-step proof leaf) root))

;; --- CORE LOGIC ---
(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint) (context (buff 32)))
    (let ((pending (map-get? PendingInscriptions { hash: hash, owner: tx-sender })))
        (if (is-some pending)
            (ok true) 
            (begin
                (asserts! (and (> chunk-count u0) (<= chunk-count MAX-CHUNK-COUNT)) ERR-INVALID-META)
                (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
                    mime-type: mime, total-size: total-size, chunk-count: chunk-count, context: context, received-count: u0
                })
                (ok true)))))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 65536)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    (let ((pending-key { hash: hash, owner: tx-sender })
          (meta (unwrap! (map-get? PendingInscriptions pending-key) ERR-NOT-FOUND))
          (context (get context meta)))
        (if (is-some (map-get? Chunks { context: context, index: index }))
            (ok true)
            (begin
                (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
                (asserts! (verify-proof hash (sha256 data) proof) ERR-INVALID-PROOF)
                (map-set Chunks { context: context, index: index } data)
                (try! (stx-transfer? (var-get royalty-fee-per-chunk) tx-sender (var-get royalty-recipient)))
                (map-set PendingInscriptions pending-key (merge meta { received-count: (+ (get received-count meta) u1) }))
                (ok true)))))

;; --- PRIVATE SEAL HELPER ---
(define-private (seal-internal (hash (buff 32)) (id uint) (meta { mime-type: (string-ascii 64), total-size: uint, chunk-count: uint, context: (buff 32), received-count: uint }))
    (begin
        (asserts! (is-eq (get received-count meta) (get chunk-count meta)) ERR-NOT-COMPLETE)
        (try! (nft-mint? xstrata-inscription id tx-sender))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            sealed: true,
            merkle-root: hash,
            data-hash: (get context meta)
        })
        (if (is-eq id u0) (var-set collection-cover-id (some u0)) true)
        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

;; --- STANDARD SEAL ---
(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (seal-internal hash (var-get next-id) meta)))

;; --- RECURSIVE SEAL ---
(define-public (seal-recursive (hash (buff 32)) (dependencies (list 10 uint)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert InscriptionDependencies id dependencies)
        (seal-internal hash id meta)))

;; --- READERS ---
(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))
(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta m (map-get? Chunks { context: (get data-hash m), index: index }) none)))

(define-read-only (get-dependencies (id uint))
    (default-to (list) (map-get? InscriptionDependencies id)))
