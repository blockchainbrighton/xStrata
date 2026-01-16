export const CONTRACT_SOURCE = `
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u262144)

(define-data-var next-id uint u0)

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

(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint
    }
)

(define-map Chunks { context: (buff 32), index: uint } (buff 262144))

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (begin
        (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count
        })
        (ok true)
    ))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 262144)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (map-set Chunks { context: hash, index: index } data)
        (ok true)))

(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            sealed: true,
            merkle-root: hash,
            data-hash: hash
        })
        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta
            m (map-get? Chunks { context: (get data-hash m), index: index })
            none)))

(define-read-only (get-pending-inscription (hash (buff 32)) (owner principal))
    (map-get? PendingInscriptions { hash: hash, owner: owner }))

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index }))
`;
export const CONTRACT_SOURCE_BATCH = `
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u65536)
(define-constant MAX-BATCH-SIZE u4)

(define-data-var next-id uint u0)

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

(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint
    }
)

(define-map Chunks { context: (buff 32), index: uint } (buff 65536))

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (begin
        (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count
        })
        (ok true)
    ))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 65536)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (map-set Chunks { context: hash, index: index } data)
        (ok true)))

(define-private (store-batch-chunk (chunk (buff 65536)) (acc (tuple (hash (buff 32)) (index uint))))
    (begin
        (map-set Chunks { context: (get hash acc), index: (get index acc) } chunk)
        { hash: (get hash acc), index: (+ (get index acc) u1) }
    ))

(define-public (add-chunk-batch (hash (buff 32)) (start-index uint) (data (list 4 (buff 65536))))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (count (len data)))
        (asserts! (> count u0) ERR-INVALID-CHUNK)
        (asserts! (<= count MAX-BATCH-SIZE) ERR-INVALID-CHUNK)
        (asserts! (<= (+ start-index count) (get chunk-count meta)) ERR-INVALID-CHUNK)
        (fold store-batch-chunk data { hash: hash, index: start-index })
        (ok true)))

(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            sealed: true,
            merkle-root: hash,
            data-hash: hash
        })
        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta
            m (map-get? Chunks { context: (get data-hash m), index: index })
            none)))

(define-read-only (get-pending-inscription (hash (buff 32)) (owner principal))
    (map-get? PendingInscriptions { hash: hash, owner: owner }))

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index }))
`;
export const CONTRACT_SOURCE_BATCHX = `
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u65536)
(define-constant MAX-BATCH-SIZE u10)

(define-data-var next-id uint u0)

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

(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint
    }
)

(define-map Chunks { context: (buff 32), index: uint } (buff 65536))

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (begin
        (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count
        })
        (ok true)
    ))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 65536)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (map-set Chunks { context: hash, index: index } data)
        (ok true)))

(define-private (store-batch-chunk (chunk (buff 65536)) (acc (tuple (hash (buff 32)) (index uint))))
    (begin
        (map-set Chunks { context: (get hash acc), index: (get index acc) } chunk)
        { hash: (get hash acc), index: (+ (get index acc) u1) }
    ))

(define-public (add-chunk-batch (hash (buff 32)) (start-index uint) (data (list 10 (buff 65536))))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (count (len data)))
        (asserts! (> count u0) ERR-INVALID-CHUNK)
        (asserts! (<= count MAX-BATCH-SIZE) ERR-INVALID-CHUNK)
        (asserts! (<= (+ start-index count) (get chunk-count meta)) ERR-INVALID-CHUNK)
        (fold store-batch-chunk data { hash: hash, index: start-index })
        (ok true)))

(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            sealed: true,
            merkle-root: hash,
            data-hash: hash
        })
        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta
            m (map-get? Chunks { context: (get data-hash m), index: index })
            none)))

(define-read-only (get-pending-inscription (hash (buff 32)) (owner principal))
    (map-get? PendingInscriptions { hash: hash, owner: owner }))

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index }))
`;
export const CONTRACT_SOURCE_BATCHXR = `
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u65536)
(define-constant MAX-BATCH-SIZE u10)

(define-constant ROYALTY-RECIPIENT 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X)
(define-constant ROYALTY-FEE u100000)

(define-data-var next-id uint u0)

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

(define-map PendingInscriptions
    { hash: (buff 32), owner: principal }
    {
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint
    }
)

(define-map Chunks { context: (buff 32), index: uint } (buff 65536))

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (begin
        (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count
        })
        (ok true)
    ))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 65536)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND)))
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (map-set Chunks { context: hash, index: index } data)
        (ok true)))

(define-private (store-batch-chunk (chunk (buff 65536)) (acc (tuple (hash (buff 32)) (index uint))))
    (begin
        (map-set Chunks { context: (get hash acc), index: (get index acc) } chunk)
        { hash: (get hash acc), index: (+ (get index acc) u1) }
    ))

(define-public (add-chunk-batch (hash (buff 32)) (start-index uint) (data (list 10 (buff 65536))))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (count (len data)))
        (asserts! (> count u0) ERR-INVALID-CHUNK)
        (asserts! (<= count MAX-BATCH-SIZE) ERR-INVALID-CHUNK)
        (asserts! (<= (+ start-index count) (get chunk-count meta)) ERR-INVALID-CHUNK)
        (try! (stx-transfer? ROYALTY-FEE tx-sender ROYALTY-RECIPIENT))
        (fold store-batch-chunk data { hash: hash, index: start-index })
        (ok true)))

(define-public (seal-inscription (hash (buff 32)))
    (let ((meta (unwrap! (map-get? PendingInscriptions { hash: hash, owner: tx-sender }) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: (get mime-type meta),
            total-size: (get total-size meta),
            chunk-count: (get chunk-count meta),
            sealed: true,
            merkle-root: hash,
            data-hash: hash
        })
        (map-delete PendingInscriptions { hash: hash, owner: tx-sender })
        (var-set next-id (+ id u1))
        (ok id)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta
            m (map-get? Chunks { context: (get data-hash m), index: index })
            none)))

(define-read-only (get-pending-inscription (hash (buff 32)) (owner principal))
    (map-get? PendingInscriptions { hash: hash, owner: owner }))

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (map-get? Chunks { context: hash, index: index }))
`;
export const CONTRACT_SOURCE_BATCHXR_V6 = `
;; u64bxr-v6-1: XStrata Inscription Registry (SIP-009 Compliant)

;; SIP-009 Trait Implementation
;; TESTNET: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait
;; MAINNET: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

(define-non-fungible-token xstrata-inscription uint)

(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant ERR-INVALID-META (err u104))
(define-constant ERR-NOT-COMPLETE (err u105))
(define-constant ERR-INVALID-PROOF (err u106))
(define-constant ERR-SENDER-NOT-OWNER (err u107))

(define-constant MAX-CHUNK-SIZE u65536)
(define-constant MAX-BATCH-SIZE u10)
(define-constant MAX-CHUNK-COUNT u1024)
(define-constant MAX-TOTAL-SIZE u67108864)
(define-constant MAX-PROOF-LEN u32)

(define-constant CONTRACT-OWNER 'ST10W2EEM757922QTVDZZ5CSEW55JEFNN33V2E7YA) ;; TODO: update for mainnet

(define-data-var royalty-recipient principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X) ;; TODO: update for mainnet
(define-data-var royalty-fee-per-chunk uint u10000)
;; Default Token URI: On-Chain Data URI (v7.0 Clean Standard)
(define-data-var token-uri (string-ascii 256) "data:application/json;base64,eyJuYW1lIjoieFN0cmF0YSIsImltYWdlIjoiZGF0YTppbWFnZS9zdmcreG1sLDxzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB2aWV3Qm94PScwIDAgMTAgMTAnPjxjaXJjbGUgY3g9JzUnIGN5PSc1JyByPSc0JyBmaWxsPSclMjM0MDgwRkYnLz48L3N2Zz4ifQ==")
(define-data-var collection-cover-id (optional uint) none)

(define-data-var next-id uint u0)

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

;; --- SIP-009 Functions ---

(define-read-only (get-last-token-id)
    (ok (- (var-get next-id) u1)))

(define-read-only (get-token-uri (id uint))
    (ok (some (var-get token-uri))))

(define-read-only (get-collection-cover-id)
    (ok (var-get collection-cover-id)))

(define-read-only (get-owner (id uint))
    (ok (nft-get-owner? xstrata-inscription id)))

;; *** CORRECTED TRANSFER FUNCTION ***
(define-public (transfer (id uint) (sender principal) (recipient principal))
    (begin
        ;; 1. Check strict ownership
        (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
        (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-SENDER-NOT-OWNER)
        
        ;; 2. Get the current inscription data so we can update it
        (let ((inscription (unwrap! (map-get? Inscriptions id) ERR-NOT-FOUND)))
            
            ;; 3. Perform the NATIVE NFT transfer
            (try! (nft-transfer? xstrata-inscription id sender recipient))
            
            ;; 4. UPDATE THE INTERNAL MAP
            ;; This ensures your website viewer updates immediately after a sale
            (map-set Inscriptions id 
                (merge inscription { owner: recipient }))
            
            (ok true))))

;; --- Admin Functions ---

(define-private (assert-owner)
    (if (is-eq tx-sender CONTRACT-OWNER)
        (ok true)
        ERR-NOT-AUTHORIZED))

(define-public (set-token-uri (value (string-ascii 256)))
    (begin
        (try! (assert-owner))
        (var-set token-uri value)
        (ok true)))

(define-public (set-collection-cover-id (id uint))
    (begin
        (try! (assert-owner))
        (var-set collection-cover-id (some id))
        (ok true)))

(define-public (set-royalty-recipient (recipient principal))
    (begin
        (try! (assert-owner))
        (var-set royalty-recipient recipient)
        (ok true)))

(define-public (set-royalty-fee-per-chunk (fee uint))
    (begin
        (try! (assert-owner))
        (var-set royalty-fee-per-chunk fee)
        (ok true)))

(define-read-only (get-royalty-config)
    {
        recipient: (var-get royalty-recipient),
        fee-per-chunk: (var-get royalty-fee-per-chunk)
    })

;; --- Helper Functions ---

(define-private (hash-pair (left (buff 32)) (right (buff 32)))
    (sha256 (concat left right)))

(define-private (chunk-size-valid? (index uint) (chunk-count uint) (total-size uint) (data (buff 65536)))
    (let ((last-index (- chunk-count u1))
          (expected-last (- total-size (* last-index MAX-CHUNK-SIZE))))
     
        (if (< index last-index)
            (is-eq (len data) MAX-CHUNK-SIZE)
            (is-eq (len data) expected-last))))

(define-private (apply-proof-step (step (tuple (hash (buff 32)) (is-left bool))) (acc (buff 32)))
    (if (get is-left step)
        (hash-pair (get hash step) acc)
        (hash-pair acc (get hash step))))

(define-private (verify-proof (root (buff 32)) (leaf (buff 32)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    (is-eq (fold apply-proof-step proof leaf) root))

;; --- Core Inscription Logic ---

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint) (context (buff 32)))
    (let ((pending (map-get? PendingInscriptions { hash: hash, owner: tx-sender })))
        (if (is-some pending)
            (let ((meta (unwrap-panic pending)))
                (asserts! (and (is-eq (get mime-type meta) mime)
                               (is-eq (get total-size meta) total-size)
                               (is-eq (get chunk-count meta) chunk-count)
                               (is-eq (get context meta) context))
                          ERR-INVALID-META)
                (ok true))
            (begin
                (asserts! (> chunk-count u0) ERR-INVALID-META)
                (asserts! (<= chunk-count MAX-CHUNK-COUNT) ERR-INVALID-META)
                (asserts! (> total-size u0) ERR-INVALID-META)
                (asserts! (<= total-size MAX-TOTAL-SIZE) ERR-INVALID-META)
                (asserts! (<= total-size (* chunk-count MAX-CHUNK-SIZE)) ERR-INVALID-META)
                (asserts! (> total-size (* (- chunk-count u1) MAX-CHUNK-SIZE)) ERR-INVALID-META)
                (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
                    mime-type: mime,
                    total-size: total-size,
                    chunk-count: chunk-count,
                    context: context,
                    received-count: u0
                })
                (ok true)))))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 65536)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    (let ((pending-key { hash: hash, owner: tx-sender })
          (meta (unwrap! (map-get? PendingInscriptions pending-key) ERR-NOT-FOUND))
          (context (get context meta)))
        
        ;; Optimization: Check if chunk exists first.
        (if (is-some (map-get? Chunks { context: context, index: index }))
            (ok true)
            (begin
                (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
                (asserts! (chunk-size-valid? index (get chunk-count meta) (get total-size meta) data) ERR-INVALID-CHUNK)
                (asserts! (<= (len proof) MAX-PROOF-LEN) ERR-INVALID-PROOF)
                (asserts! (verify-proof hash (sha256 data) proof) ERR-INVALID-PROOF)

                (map-set Chunks { context: context, index: index } data)
                
                (try! (stx-transfer? (var-get royalty-fee-per-chunk) tx-sender (var-get royalty-recipient)))
                
                (map-set PendingInscriptions pending-key 
                    (merge meta { received-count: (+ (get received-count meta) u1) }))
                (ok true)))))

(define-private (pack-batch-item (chunk (buff 65536)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool)))))
    { chunk: chunk, proof: proof })

(define-private (store-batch-chunk (item (tuple (chunk (buff 65536)) (proof (list 32 (tuple (hash (buff 32)) (is-left bool))))))
                                  (response-acc (response (tuple (hash (buff 32)) (context (buff 32)) (index uint) (chunk-count uint) (total-size uint) (new-count uint)) uint)))
    (match response-acc
        acc 
        (let ((idx (get index acc))
              (context (get context acc)))
            
            ;; Optimization: Check if chunk exists
            (if (is-some (map-get? Chunks { context: context, index: idx }))
                (ok (merge acc { index: (+ idx u1) })) 
                (begin
                    (asserts! (chunk-size-valid? idx (get chunk-count acc) (get total-size acc) (get chunk item)) ERR-INVALID-CHUNK)
                    (asserts! (<= (len (get proof item)) MAX-PROOF-LEN) ERR-INVALID-PROOF)
                    (asserts! (verify-proof (get hash acc) (sha256 (get chunk item)) (get proof item)) ERR-INVALID-PROOF)
                    
                    (map-set Chunks { context: context, index: idx } (get chunk item))
                    
                    (ok (merge acc { 
                        index: (+ idx u1), 
                        new-count: (+ (get new-count acc) u1) 
                    })))))
        err-value (err err-value)))

(define-public (add-chunk-batch (hash (buff 32)) (start-index uint) (data (list 10 (buff 65536))) (proofs (list 10 (list 32 (tuple (hash (buff 32)) (is-left bool))))))
    (let ((pending-key { hash: hash, owner: tx-sender })
          (meta (unwrap! (map-get? PendingInscriptions pending-key) ERR-NOT-FOUND))
          (count (len data)))
        
        (asserts! (> count u0) ERR-INVALID-CHUNK)
        (asserts! (<= count MAX-BATCH-SIZE) ERR-INVALID-CHUNK)
        (asserts! (is-eq count (len proofs)) ERR-INVALID-PROOF)
        (asserts! (<= (+ start-index count) (get chunk-count meta)) ERR-INVALID-CHUNK)
        
        (let ((items (map pack-batch-item data proofs))
              (folded (try! (fold store-batch-chunk items (ok { 
                  hash: hash, 
                  context: (get context meta), 
                  index: start-index, 
                  chunk-count: (get chunk-count meta), 
                  total-size: (get total-size meta), 
                  new-count: u0 
              })))))
              
            (let ((new-count (get new-count folded)))
                (and (> new-count u0)
                    (try! (stx-transfer? (* new-count (var-get royalty-fee-per-chunk)) tx-sender (var-get royalty-recipient))))
                    
                (if (> new-count u0)
                    (map-set PendingInscriptions pending-key 
                        (merge meta { received-count: (+ (get received-count meta) new-count) }))
                    true)
                (ok true)))))

(define-public (seal-inscription (hash (buff 32)))
    (let ((pending-key { hash: hash, owner: tx-sender })
          (meta (unwrap! (map-get? PendingInscriptions pending-key) ERR-NOT-FOUND))
          (id (var-get next-id)))
        (asserts! (is-eq (get received-count meta) (get chunk-count meta)) ERR-NOT-COMPLETE)
        
        ;; SIP-009: Mint the NFT
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
        
        ;; Auto-set collection cover if this is the first inscription
        (if (is-eq id u0)
            (var-set collection-cover-id (some u0))
            true)

        (map-delete PendingInscriptions pending-key)
        (var-set next-id (+ id u1))
        (ok id)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))

(define-read-only (get-chunk (id uint) (index uint)) 
    (let ((meta (map-get? Inscriptions id)))
        (match meta
            m (map-get? Chunks { context: (get data-hash m), index: index })
            none)))

(define-read-only (get-pending-inscription (hash (buff 32)) (owner principal))
    (map-get? PendingInscriptions { hash: hash, owner: owner }))

(define-read-only (get-pending-chunk (hash (buff 32)) (index uint))
    (let ((meta (map-get? PendingInscriptions { hash: hash, owner: tx-sender })))
        (match meta
            m (if (is-some (map-get? Chunks { context: (get context m), index: index }))
                  (some true)
                  none)
            none)))`;

export const CONTRACT_SOURCE_BATCHXR_V9 = `
;; --- TRAIT DEFINITIONS ---

;; [DEVNET / CLARINET] - USE THIS FOR CONSOLE TESTING
;; (impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
;; (use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

;; [TESTNET]
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
                    mime-type: mime,
                    total-size: total-size,
                    chunk-count: chunk-count,
                    received-count: u0
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
`;

export const CONTRACT_SOURCE_BATCHXR_V9_2 = `
;; u64bxr-v9.2: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
`;

export const CONTRACT_SOURCE_BATCHXR_V9_2_2 = `
;; u64bxr-v9.2.2: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
`;

export const CONTRACT_SOURCE_BATCHXR_V9_2_3 = `
;; u64bxr-v9.2.3: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
`




export const CONTRACT_SOURCE_BATCHXR_V9_2_5 = `
;; u64bxr-v9.2.5: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
            (if (is-eq tx-sender (var-get royalty-recipient))
                true
                (try! (stx-transfer? (* (var-get royalty-fee-per-chunk) batch-size) tx-sender (var-get royalty-recipient)))
            )
            true
        )

        ;; 2. Process chunks
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
`


export const CONTRACT_SOURCE_BATCHXR_V9_2_6 = `
;; u64bxr-v9.2.6: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
;; Batch size raised; use smaller chunks to stay under payload limits
(define-constant MAX-BATCH-SIZE u20) 

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
(define-map Chunks { context: (buff 32), index: uint } (buff 16384))

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
(define-public (add-chunk-batch (hash (buff 32)) (chunks (list 20 (buff 16384))))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: hash }) ERR-NOT-FOUND))
        (start-idx (get current-index state))
        (start-hash (get running-hash state))
        (batch-size (len chunks))
    )
        ;; 1. Calculate and Transfer Royalties for the whole batch
        (if (> (var-get royalty-fee-per-chunk) u0)
            (if (is-eq tx-sender (var-get royalty-recipient))
                true
                (try! (stx-transfer? (* (var-get royalty-fee-per-chunk) batch-size) tx-sender (var-get royalty-recipient)))
            )
            true
        )

        ;; 2. Process chunks
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
(define-private (process-chunk (data (buff 16384)) (ctx { idx: uint, run-hash: (buff 32), target-hash: (buff 32) }))
    (let (
        (current-idx (get idx ctx))
        (current-hash (get run-hash ctx))
        (target-hash (get target-hash ctx))
        
        ;; SEQUENTIAL HASHING: Next = sha256(CurrentHash + Data)
        ;; This enforces strict ordering of chunks.
        (next-hash (sha256 (concat current-hash data)))
    )
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
`


export const CONTRACT_SOURCE_BATCHXR_V9_2_7 = `
;; u64bxr-v9.2.7: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
;; Batch size raised; use smaller chunks to stay under payload limits
(define-constant MAX-BATCH-SIZE u50) 

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
(define-map Chunks { context: (buff 32), index: uint } (buff 16384))

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
(define-public (add-chunk-batch (hash (buff 32)) (chunks (list 50 (buff 16384))))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: hash }) ERR-NOT-FOUND))
        (start-idx (get current-index state))
        (start-hash (get running-hash state))
        (batch-size (len chunks))
    )
        ;; 1. Calculate and Transfer Royalties for the whole batch
        (if (> (var-get royalty-fee-per-chunk) u0)
            (if (is-eq tx-sender (var-get royalty-recipient))
                true
                (try! (stx-transfer? (* (var-get royalty-fee-per-chunk) batch-size) tx-sender (var-get royalty-recipient)))
            )
            true
        )

        ;; 2. Process chunks
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
(define-private (process-chunk (data (buff 16384)) (ctx { idx: uint, run-hash: (buff 32), target-hash: (buff 32) }))
    (let (
        (current-idx (get idx ctx))
        (current-hash (get run-hash ctx))
        (target-hash (get target-hash ctx))
        
        ;; SEQUENTIAL HASHING: Next = sha256(CurrentHash + Data)
        ;; This enforces strict ordering of chunks.
        (next-hash (sha256 (concat current-hash data)))
    )
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
`


export const CONTRACT_SOURCE_BATCHXR_V9_2_8 = `
;; u64bxr-v9.2.8: xStrata Optimized Protocol
;; Features: Sequential Hash Chaining, Batching, SIP-009/016 Compliant
;; Audited & Fixed

;; --- TRAIT DEFINITIONS ---
;; Ensure you use the correct trait depending on the network (Mainnet vs Testnet)
;; For local development/clarinet, use the path to your trait file.
(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)
(impl-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait.nft-trait)

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
;; Batch size raised; use smaller chunks to stay under payload limits
(define-constant MAX-BATCH-SIZE u50) 

;; --- ROYALTY CONSTANTS (microSTX) ---
;; Begin royalty: 0.1 STX
(define-constant ROYALTY-BEGIN u100000)
;; Seal royalty base: 0.1 STX
(define-constant ROYALTY-SEAL-BASE u100000)
;; Seal royalty per chunk: 0.01 STX
(define-constant ROYALTY-SEAL-PER-CHUNK u10000)

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
        total-chunks: uint,
        current-index: uint,
        running-hash: (buff 32)
    }
)

;; The Data Store
;; Keyed by Content Hash (Context) to allow deduplication across different NFTs
(define-map Chunks { context: (buff 32), index: uint } (buff 16384))

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

;; --- CORE LOGIC ---

;; 1. BEGIN: Initialize the upload session
;; We define the "Expected Hash" upfront. The upload is only valid if the data matches this hash.
(define-public (begin-inscription (expected-hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (total-chunks uint))
    (begin
        ;; If an upload state already exists, we don't overwrite it to prevent griefing progress
        (asserts! (is-none (map-get? UploadState { owner: tx-sender, hash: expected-hash })) ERR-ALREADY-SEALED)

        ;; Royalty (begin)
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
                running-hash: 0x0000000000000000000000000000000000000000000000000000000000000000 ;; Seed hash
            }
        )
        (ok true)
    )
)

;; 2. BATCH ADD: Process multiple chunks efficiently
;; Uses Fold to iterate through a list of chunks, updating the running hash and storing data.
(define-public (add-chunk-batch (hash (buff 32)) (chunks (list 50 (buff 16384))))
    (let (
        (state (unwrap! (map-get? UploadState { owner: tx-sender, hash: hash }) ERR-NOT-FOUND))
        (start-idx (get current-index state))
        (start-hash (get running-hash state))
    )
        ;; Process chunks
        ;; fold iterates over 'chunks'. We pass an accumulator context to track index and hash.
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
(define-private (process-chunk (data (buff 16384)) (ctx { idx: uint, run-hash: (buff 32), target-hash: (buff 32) }))
    (let (
        (current-idx (get idx ctx))
        (current-hash (get run-hash ctx))
        (target-hash (get target-hash ctx))
        
        ;; SEQUENTIAL HASHING: Next = sha256(CurrentHash + Data)
        ;; This enforces strict ordering of chunks.
        (next-hash (sha256 (concat current-hash data)))
    )
        ;; Store the chunk. We use 'target-hash' (the final expected hash) as the Context ID.
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
        (chunks (get total-chunks state))
        (seal-royalty (+ ROYALTY-SEAL-BASE (* ROYALTY-SEAL-PER-CHUNK chunks)))
    )
        ;; VERIFY INTEGRITY: The running hash chain must match the expected hash provided at start.
        (asserts! (is-eq final-hash expected-hash) ERR-HASH-MISMATCH)

        ;; Royalty (seal)
        (if (> seal-royalty u0)
            (if (is-eq tx-sender (var-get royalty-recipient))
                true
                (try! (stx-transfer? seal-royalty tx-sender (var-get royalty-recipient)))
            )
            true
        )
        
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

`

export const CONTRACT_SOURCE_SVG_REGISTRY = `
;; svg-registry.clar
;; Simple On-Chain SVG Registry
;; Purpose: serve hardcoded SVG strings to other contracts (no metadata, no token-uri).
;; Notes:
;; - NO HTTP links are used as external references. The only "http://www.w3.org/2000/svg"
;;   string is the SVG XML namespace identifier (not fetched).
;; - Clarity has no forward references: define helpers/private library before public entrypoints.
;; - This contract does NOT implement SIP-009. It is a pure SVG provider.

;; --------------------------------------------------------------------------
;; PUBLIC API
;; --------------------------------------------------------------------------
;; (get-svg id) -> (response (string-utf8 N) uint)
;; Returns (ok "<svg ...>...</svg>") for known ids, otherwise (err u404)

(define-constant ERR-NOT-FOUND u404)

(define-read-only (get-svg (id uint))
  (let ((svg (get-svg-raw id)))
    (if (is-eq svg none)
        (err ERR-NOT-FOUND)
        (ok (unwrap-panic svg))
    )
  )
)

;; --------------------------------------------------------------------------
;; INTERNAL DISPATCH
;; --------------------------------------------------------------------------

(define-private (get-svg-raw (id uint))
  (if (and (>= id u1) (<= id u6))
      (some (get-audionals-pixel id))
      (if (and (>= id u11) (<= id u16))
          (some (get-audionals-wave id))
          (if (and (>= id u21) (<= id u29))
              (some (get-lamina id))
              (if (and (>= id u31) (<= id u36))
                  (some (get-inscripta id))
                  (if (and (>= id u41) (<= id u49))
                      (some (get-strata id))
                      (if (and (>= id u51) (<= id u56))
                          (some (get-xts id))
                          none
                      )
                  )
              )
          )
      )
  )
)

;; --------------------------------------------------------------------------
;; ASSET LIBRARY (Hardcoded SVGs)
;; --------------------------------------------------------------------------
;; Conventions:
;; - Use single quotes inside SVG attributes to avoid escaping when embedded elsewhere.
;; - Keep viewBox consistent (0 0 100 100) for predictable rendering.

;; AUDIONALS PIXEL (IDs 1-6)
(define-private (get-audionals-pixel (id uint))
  (if (is-eq id u1)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><path d='M20 30 H30 V70 H20 Z M70 30 H80 V70 H70 Z M30 20 H70 V30 H30 Z M30 30 H70 V70 H30 Z' opacity='0.3'/><rect x='35' y='40' width='10' height='10' fill='white'/><rect x='55' y='40' width='10' height='10' fill='white'/><rect x='40' y='60' width='20' height='5' fill='white'/><path d='M20 30 H30 V70 H20 Z M70 30 H80 V70 H70 Z M30 20 H70 V30 H30 Z'/></svg>"
      (if (is-eq id u2)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><path d='M15 30 H30 V75 H15 Z M70 30 H85 V75 H70 Z M30 20 H70 V35 H30 Z'/><rect x='30' y='40' width='40' height='15' fill='#5546FF' opacity='0.5'/><rect x='35' y='65' width='30' height='5' fill='white'/></svg>"
          (if (is-eq id u3)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='20' y='30' width='10' height='40'/><rect x='70' y='30' width='10' height='40'/><rect x='30' y='20' width='40' height='10'/><rect x='35' y='40' width='10' height='10jbmmrk8='0.5'/><rect x='55' y='40' width='10' height='10' opacity='0.5'/><rect x='45' y='60' width='10' height='10' opacity='0.8'/></svg>"
              (if (is-eq id u4)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='25' y='25' width='15' height='50'/><rect x='45' y='25' width='30' height='50'/><rect x='50' y='35' width='20' height='30' fill='white' opacity='0.2'/><circle cx='32' cy='50' r='3' fill='white'/><circle cx='60' cy='50' r='10' fill='none' stroke='white' stroke-width='2'/></svg>"
                  (if (is-eq id u5)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='20' y='20' width='60' height='60' rx='2' opacity='0.5'/><rect x='25' y='30' width='40' height='5' fill='white'/><rect x='35' y='45' width='50' height='5' fill='white'/><rect x='15' y='60' width='30' height='5' fill='white'/><rect x='25' y='25' width='5' height='5' fill='white'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='10' y='30' width='80' height='40' rx='2'/><rect x='20' y='35' width='60' height='30' fill='black'/><circle cx='35' cy='50' r='8' fill='white'/><circle cx='65' cy='50' r='8' fill='white'/><rect x='15' y='75' width='70' height='5' opacity='0.5'/></svg>"
                  )
              )
          )
      )
  )
)

;; AUDIONALS WAVE (IDs 11-16)
(define-private (get-audionals-wave (id uint))
  (if (is-eq id u11)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 50 Q 25 20, 40 50 T 70 50 T 100 50 V 60 Q 85 90, 70 60 T 40 60 T 10 60 Z' opacity='0.8'/><path d='M0 50 H 100' stroke='#5546FF' stroke-width='2'/><rect x='15' y='40' width='5' height='20' rx='2'/><rect x='25' y='30' width='5' height='40' rx='2'/><rect x='35' y='20' width='5' height='60' rx='2'/><rect x='45' y='35' width='5' height='30' rx='2'/><rect x='55' y='25' width='5' height='50' rx='2'/><rect x='65' y='40' width='5' height='20' rx='2'/><rect x='75' y='45' width='5' height='10' rx='2'/></svg>"
      (if (is-eq id u12)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='6'><circle cx='50' cy='50' r='15' opacity='1.0'/><circle cx='50' cy='50' r='25' opacity='0.7'/><circle cx='50' cy='50' r='35' opacity='0.4'/><circle cx='50' cy='50' r='45' opacity='0.2'/><path d='M50 50 L85 50' stroke-width='4'/></svg>"
          (if (is-eq id u13)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='60' width='15' height='30'/><rect x='30' y='40' width='15' height='50'/><rect x='50' y='20' width='15' height='70'/><rect x='70' y='50' width='15' height='40'/><rect x='10' y='55' width='15' height='2' opacity='0.5'/><rect x='30' y='35' width='15' height='2' opacity='0.5'/><rect x='50' y='15' width='15' height='2' opacity='0.5'/><rect x='70' y='45' width='15' height='2' opacity='0.5'/></svg>"
              (if (is-eq id u14)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='4'><path d='M10 50 H 35 L 45 20 L 55 80 L 65 50 H 90'/><circle cx='50' cy='50' r='40' opacity='0.2' stroke-width='2'/></svg>"
                  (if (is-eq id u15)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='4' stroke-linecap='round'><path d='M20 50 A 30 30 0 0 1 80 50'/><path d='M30 50 A 20 20 0 0 1 70 50'/><path d='M40 50 A 10 10 0 0 1 60 50'/><circle cx='50' cy='50' r='3' fill='#5546FF'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='40' width='5' height='20' opacity='0.4'/><rect x='20' y='20' width='5' height='60' opacity='0.8'/><rect x='30' y='35' width='5' height='30'/><rect x='40' y='10' width='5' height='80'/><rect x='50' y='30' width='5' height='40'/><rect x='60' y='15' width='5' height='70' opacity='0.8'/><rect x='70' y='45' width='5' height='10' opacity='0.4'/></svg>"
                  )
              )
          )
      )
  )
)

;; LAMINA (IDs 21-29)
(define-private (get-lamina (id uint))
  (if (is-eq id u21)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='20' width='60' height='60' rx='2' opacity='0.3'/><rect x='25' y='25' width='60' height='60' rx='2' opacity='0.6'/><rect x='30' y='30' width='60' height='60' rx='2'/></svg>"
      (if (is-eq id u22)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='6'><path d='M10 30 L90 30 M10 50 L90 50 M10 70 L90 70'/></svg>"
          (if (is-eq id u23)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 80 L90 80 L70 60 L10 60 Z' opacity='0.5'/><path d='M10 55 L70 55 L50 35 L10 35 Z'/></svg>"
              (if (is-eq id u24)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8'><path d='M30 20 L30 80 L80 80' opacity='0.3'/><path d='M20 30 L20 90 L70 90' opacity='0.6'/><path d='M10 40 L10 100 L60 100'/></svg>"
                  (if (is-eq id u25)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M20 20 V80 H80 V60 H40 V20 Z'/><path d='M25 25 V75 H75' fill='none' stroke='black' stroke-width='2' opacity='0.5'/><path d='M30 30 V70 H70' fill='none' stroke='black' stroke-width='2' opacity='0.3'/></svg>"
                      (if (is-eq id u26)
                          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 70 L40 50 L90 50 L60 70 Z'/><path d='M10 70 L40 50 L40 20 L10 40 Z' opacity='0.6'/><path d='M40 50 L90 50 L90 20 L40 20 Z' opacity='0.3'/></svg>"
                          (if (is-eq id u27)
                              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='20' width='80' height='15' rx='2'/><rect x='10' y='45' width='60' height='15' rx='2' opacity='0.6'/><rect x='10' y='70' width='80' height='15' rx='2' opacity='0.3'/></svg>"
                              (if (is-eq id u28)
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M20 80 L80 20 L90 30 L30 90 Z'/><path d='M30 70 L70 30' stroke='black' stroke-width='4'/></svg>"
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='20' width='20' height='60'/><rect x='45' y='10' width='20' height='60' opacity='0.7'/><rect x='70' y='30' width='10' height='60' opacity='0.4'/></svg>"
                              )
                          )
                      )
                  )
              )
          )
      )
  )
)

;; INSCRIPTA (IDs 31-36)
(define-private (get-inscripta (id uint))
  (if (is-eq id u31)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='15' width='60' height='70' rx='4'/><rect x='30' y='30' width='40' height='5' fill='white'/><rect x='30' y='45' width='25' height='5' fill='white'/><rect x='30' y='60' width='40' height='5' fill='white'/></svg>"
      (if (is-eq id u32)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8' stroke-linecap='square'><path d='M30 20 L20 20 L20 80 L30 80'/><path d='M70 20 L80 20 L80 80 L70 80'/><circle cx='50' cy='50' r='8' fill='#5546FF'/></svg>"
          (if (is-eq id u33)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M50 10 L60 30 L40 30 Z'/><rect x='45' y='32' width='10' height='50'/><path d='M20 90 L80 90 L50 30 Z' opacity='0.2'/></svg>"
              (if (is-eq id u34)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='30' width='60' height='40' rx='2'/><path d='M30 40 L40 50 L30 60' stroke='white' stroke-width='4' fill='none'/><rect x='45' y='55' width='15' height='4' fill='white'/></svg>"
                  (if (is-eq id u35)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='6'><path d='M50 20 L80 80 L20 80 Z'/><circle cx='50' cy='55' r='8' fill='#5546FF'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='20' width='60' height='60' rx='2' opacity='0.2'/><rect x='25' y='25' width='10' height='10'/><rect x='40' y='25' width='10' height='10'/><rect x='55' y='25' width='10' height='10'/><rect x='25' y='40' width='10' height='10'/><rect x='40' y='40' width='10' height='10' opacity='0.5'/><rect x='55' y='40' width='10' height='10' opacity='0.5'/></svg>"
                  )
              )
          )
      )
  )
)

;; STRATA (IDs 41-49)
(define-private (get-strata (id uint))
  (if (is-eq id u41)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 80 Q 50 60 90 80 L 90 100 L 10 100 Z'/><path d='M10 50 Q 50 30 90 50 L 90 70 Q 50 50 10 70 Z' opacity='0.7'/><path d='M10 20 Q 50 0 90 20 L 90 40 Q 50 20 10 40 Z' opacity='0.4'/></svg>"
      (if (is-eq id u42)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8'><rect x='10' y='70' width='80' height='20'/><rect x='20' y='45' width='60' height='20'/><rect x='30' y='20' width='40' height='20'/></svg>"
          (if (is-eq id u43)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='10' width='80' height='80' rx='40' opacity='0.2'/><rect x='25' y='25' width='50' height='50' rx='25' opacity='0.5'/><rect x='40' y='40' width='20' height='20' rx='10'/></svg>"
              (if (is-eq id u44)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M0 30 Q 50 10 100 30 V 50 Q 50 30 0 50 Z' opacity='0.8'/><path d='M0 50 Q 50 70 100 50 V 70 Q 50 90 0 70 Z' opacity='0.5'/><path d='M0 70 Q 50 50 100 70 V 90 Q 50 70 0 90 Z' opacity='0.2'/></svg>"
                  (if (is-eq id u45)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='3'><path d='M0 20 C 30 10, 70 30, 100 20'/><path d='M0 35 C 40 45, 60 15, 100 35' opacity='0.8'/><path d='M0 50 C 20 60, 80 40, 100 50' opacity='0.6'/><path d='M0 65 C 50 55, 50 75, 100 65' opacity='0.4'/><path d='M0 80 C 30 90, 70 70, 100 80' opacity='0.2'/></svg>"
                      (if (is-eq id u46)
                          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='70' width='20' height='12' rx='2'/><rect x='35' y='68' width='25' height='12' rx='2'/><rect x='65' y='72' width='25' height='12' rx='2'/><rect x='15' y='50' width='30' height='12' rx='2' opacity='0.6'/><rect x='50' y='48' width='30' height='12' rx='2' opacity='0.6'/><rect x='25' y='30' width='20' height='12' rx='2' opacity='0.3'/><rect x='50' y='32' width='25' height='12' rx='2' opacity='0.3'/></svg>"
                          (if (is-eq id u47)
                              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='20' width='35' height='60' rx='2'/><rect x='55' y='20' width='35' height='60' rx='2' opacity='0.5'/><rect x='48' y='25' width='4' height='50' fill='white' opacity='0.2'/></svg>"
                              (if (is-eq id u48)
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 20 L40 20 L40 80 L10 80 Z'/><path d='M60 20 L90 20 L90 80 L60 80 Z'/><path d='M10 50 L90 50' stroke='black' stroke-width='10' opacity='0.5'/></svg>"
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='60' width='80' height='20' rx='2'/><circle cx='20' cy='50' r='3'/><circle cx='35' cy='45' r='4'/><circle cx='50' cy='52' r='2'/><circle cx='65' cy='48' r='3'/><circle cx='80' cy='53' r='4'/><rect x='10' y='20' width='80' height='15' opacity='0.3'/></svg>"
                              )
                          )
                      )
                  )
              )
          )
      )
  )
)

;; XTS (IDs 51-56)
(define-private (get-xts (id uint))
  (if (is-eq id u51)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M20 20 L80 20 L50 50 Z'/><path d='M20 80 L80 80 L50 50 Z' opacity='0.6'/></svg>"
      (if (is-eq id u52)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='35' y='10' width='30' height='35' rx='2'/><rect x='35' y='55' width='30' height='35' rx='2' opacity='0.5'/><rect x='20' y='48' width='60' height='4' rx='2'/></svg>"
          (if (is-eq id u53)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8'><path d='M20 20 L50 50'/><path d='M80 20 L50 50'/><path d='M20 80 L50 50'/><path d='M80 80 L50 50'/></svg>"
              (if (is-eq id u54)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='4'><path d='M50 10 L50 90 M10 50 L90 50'/><circle cx='50' cy='50' r='20'/><rect x='45' y='45' width='10' height='10' fill='#5546FF'/></svg>"
                  (if (is-eq id u55)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M50 50 L20 20 L20 40 Z'/><path d='M50 50 L80 20 L80 40 Z' opacity='0.8'/><path d='M50 50 L20 80 L20 60 Z' opacity='0.6'/><path d='M50 50 L80 80 L80 60 Z' opacity='0.4'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' opacity='0.5'><path d='M50 10 L85 80 H15 Z'/><path d='M50 90 L15 20 H85 Z' fill='none' stroke='#5546FF' stroke-width='4'/></svg>"
                  )
              )
          )
      )
  )
)

`

export const CONTRACT_SOURCE_SVG_REGISTRY_V2 = `
;; svg-registry.clar
;; Simple On-Chain SVG Registry
;; Purpose:
;; - Serve hardcoded SVG strings to other contracts (no metadata, no token-uri).
;; - Provide an optional "URL-like" data URI wrapper for wallets/marketplaces and NFT contracts.
;;
;; Notes:
;; - NO external HTTP links are used as external references.
;;   The only "http://www.w3.org/2000/svg" string is the SVG XML namespace identifier (not fetched).
;; - Clarity has no forward references: helpers/private library must appear before public entrypoints.
;; - This contract does NOT implement SIP-009. It is a pure SVG provider.

(define-constant ERR-NOT-FOUND u404)

;; --------------------------------------------------------------------------
;; INTERNAL DISPATCH
;; --------------------------------------------------------------------------

(define-private (get-svg-raw (id uint))
  (if (and (>= id u1) (<= id u6))
      (some (get-audionals-pixel id))
      (if (and (>= id u11) (<= id u16))
          (some (get-audionals-wave id))
          (if (and (>= id u21) (<= id u29))
              (some (get-lamina id))
              (if (and (>= id u31) (<= id u36))
                  (some (get-inscripta id))
                  (if (and (>= id u41) (<= id u49))
                      (some (get-strata id))
                      (if (and (>= id u51) (<= id u56))
                          (some (get-xts id))
                          none
                      )
                  )
              )
          )
      )
  )
)

;; --------------------------------------------------------------------------
;; ASSET LIBRARY (Hardcoded SVGs)
;; --------------------------------------------------------------------------
;; Conventions:
;; - Use single quotes inside SVG attributes to avoid escaping when embedded elsewhere.
;; - Keep viewBox consistent (0 0 100 100) for predictable rendering.
;;
;; IMPORTANT:
;; - If you intend to embed via \`data:image/svg+xml;utf8,\` some renderers are picky about
;;   characters like '#'. If you hit that, consider encoding '#' as '%23' in your SVG strings,
;;   or use a base64 gateway off-chain. This contract simply wraps as-is.

;; AUDIONALS PIXEL (IDs 1-6)
(define-private (get-audionals-pixel (id uint))
  (if (is-eq id u1)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><path d='M20 30 H30 V70 H20 Z M70 30 H80 V70 H70 Z M30 20 H70 V30 H30 Z M30 30 H70 V70 H30 Z' opacity='0.3'/><rect x='35' y='40' width='10' height='10' fill='white'/><rect x='55' y='40' width='10' height='10' fill='white'/><rect x='40' y='60' width='20' height='5' fill='white'/><path d='M20 30 H30 V70 H20 Z M70 30 H80 V70 H70 Z M30 20 H70 V30 H30 Z'/></svg>"
      (if (is-eq id u2)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><path d='M15 30 H30 V75 H15 Z M70 30 H85 V75 H70 Z M30 20 H70 V35 H30 Z'/><rect x='30' y='40' width='40' height='15' fill='#5546FF' opacity='0.5'/><rect x='35' y='65' width='30' height='5' fill='white'/></svg>"
          (if (is-eq id u3)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='20' y='30' width='10' height='40'/><rect x='70' y='30' width='10' height='40'/><rect x='30' y='20' width='40' height='10'/><rect x='35' y='40' width='10' height='10' opacity='0.5'/><rect x='55' y='40' width='10' height='10' opacity='0.5'/><rect x='45' y='60' width='10' height='10' opacity='0.8'/></svg>"
              (if (is-eq id u4)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='25' y='25' width='15' height='50'/><rect x='45' y='25' width='30' height='50'/><rect x='50' y='35' width='20' height='30' fill='white' opacity='0.2'/><circle cx='32' cy='50' r='3' fill='white'/><circle cx='60' cy='50' r='10' fill='none' stroke='white' stroke-width='2'/></svg>"
                  (if (is-eq id u5)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='20' y='20' width='60' height='60' rx='2' opacity='0.5'/><rect x='25' y='30' width='40' height='5' fill='white'/><rect x='35' y='45' width='50' height='5' fill='white'/><rect x='15' y='60' width='30' height='5' fill='white'/><rect x='25' y='25' width='5' height='5' fill='white'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' shape-rendering='crispEdges'><rect x='10' y='30' width='80' height='40' rx='2'/><rect x='20' y='35' width='60' height='30' fill='black'/><circle cx='35' cy='50' r='8' fill='white'/><circle cx='65' cy='50' r='8' fill='white'/><rect x='15' y='75' width='70' height='5' opacity='0.5'/></svg>"
                  )
              )
          )
      )
  )
)

;; AUDIONALS WAVE (IDs 11-16)
(define-private (get-audionals-wave (id uint))
  (if (is-eq id u11)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 50 Q 25 20, 40 50 T 70 50 T 100 50 V 60 Q 85 90, 70 60 T 40 60 T 10 60 Z' opacity='0.8'/><path d='M0 50 H 100' stroke='#5546FF' stroke-width='2'/><rect x='15' y='40' width='5' height='20' rx='2'/><rect x='25' y='30' width='5' height='40' rx='2'/><rect x='35' y='20' width='5' height='60' rx='2'/><rect x='45' y='35' width='5' height='30' rx='2'/><rect x='55' y='25' width='5' height='50' rx='2'/><rect x='65' y='40' width='5' height='20' rx='2'/><rect x='75' y='45' width='5' height='10' rx='2'/></svg>"
      (if (is-eq id u12)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='6'><circle cx='50' cy='50' r='15' opacity='1.0'/><circle cx='50' cy='50' r='25' opacity='0.7'/><circle cx='50' cy='50' r='35' opacity='0.4'/><circle cx='50' cy='50' r='45' opacity='0.2'/><path d='M50 50 L85 50' stroke-width='4'/></svg>"
          (if (is-eq id u13)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='60' width='15' height='30'/><rect x='30' y='40' width='15' height='50'/><rect x='50' y='20' width='15' height='70'/><rect x='70' y='50' width='15' height='40'/><rect x='10' y='55' width='15' height='2' opacity='0.5'/><rect x='30' y='35' width='15' height='2' opacity='0.5'/><rect x='50' y='15' width='15' height='2' opacity='0.5'/><rect x='70' y='45' width='15' height='2' opacity='0.5'/></svg>"
              (if (is-eq id u14)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='4'><path d='M10 50 H 35 L 45 20 L 55 80 L 65 50 H 90'/><circle cx='50' cy='50' r='40' opacity='0.2' stroke-width='2'/></svg>"
                  (if (is-eq id u15)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='4' stroke-linecap='round'><path d='M20 50 A 30 30 0 0 1 80 50'/><path d='M30 50 A 20 20 0 0 1 70 50'/><path d='M40 50 A 10 10 0 0 1 60 50'/><circle cx='50' cy='50' r='3' fill='#5546FF'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='40' width='5' height='20' opacity='0.4'/><rect x='20' y='20' width='5' height='60' opacity='0.8'/><rect x='30' y='35' width='5' height='30'/><rect x='40' y='10' width='5' height='80'/><rect x='50' y='30' width='5' height='40'/><rect x='60' y='15' width='5' height='70' opacity='0.8'/><rect x='70' y='45' width='5' height='10' opacity='0.4'/></svg>"
                  )
              )
          )
      )
  )
)

;; LAMINA (IDs 21-29)
(define-private (get-lamina (id uint))
  (if (is-eq id u21)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='20' width='60' height='60' rx='2' opacity='0.3'/><rect x='25' y='25' width='60' height='60' rx='2' opacity='0.6'/><rect x='30' y='30' width='60' height='60' rx='2'/></svg>"
      (if (is-eq id u22)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='6'><path d='M10 30 L90 30 M10 50 L90 50 M10 70 L90 70'/></svg>"
          (if (is-eq id u23)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 80 L90 80 L70 60 L10 60 Z' opacity='0.5'/><path d='M10 55 L70 55 L50 35 L10 35 Z'/></svg>"
              (if (is-eq id u24)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8'><path d='M30 20 L30 80 L80 80' opacity='0.3'/><path d='M20 30 L20 90 L70 90' opacity='0.6'/><path d='M10 40 L10 100 L60 100'/></svg>"
                  (if (is-eq id u25)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M20 20 V80 H80 V60 H40 V20 Z'/><path d='M25 25 V75 H75' fill='none' stroke='black' stroke-width='2' opacity='0.5'/><path d='M30 30 V70 H70' fill='none' stroke='black' stroke-width='2' opacity='0.3'/></svg>"
                      (if (is-eq id u26)
                          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 70 L40 50 L90 50 L60 70 Z'/><path d='M10 70 L40 50 L40 20 L10 40 Z' opacity='0.6'/><path d='M40 50 L90 50 L90 20 L40 20 Z' opacity='0.3'/></svg>"
                          (if (is-eq id u27)
                              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='20' width='80' height='15' rx='2'/><rect x='10' y='45' width='60' height='15' rx='2' opacity='0.6'/><rect x='10' y='70' width='80' height='15' rx='2' opacity='0.3'/></svg>"
                              (if (is-eq id u28)
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M20 80 L80 20 L90 30 L30 90 Z'/><path d='M30 70 L70 30' stroke='black' stroke-width='4'/></svg>"
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='20' width='20' height='60'/><rect x='45' y='10' width='20' height='60' opacity='0.7'/><rect x='70' y='30' width='10' height='60' opacity='0.4'/></svg>"
                              )
                          )
                      )
                  )
              )
          )
      )
  )
)

;; INSCRIPTA (IDs 31-36)
(define-private (get-inscripta (id uint))
  (if (is-eq id u31)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='15' width='60' height='70' rx='4'/><rect x='30' y='30' width='40' height='5' fill='white'/><rect x='30' y='45' width='25' height='5' fill='white'/><rect x='30' y='60' width='40' height='5' fill='white'/></svg>"
      (if (is-eq id u32)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8' stroke-linecap='square'><path d='M30 20 L20 20 L20 80 L30 80'/><path d='M70 20 L80 20 L80 80 L70 80'/><circle cx='50' cy='50' r='8' fill='#5546FF'/></svg>"
          (if (is-eq id u33)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M50 10 L60 30 L40 30 Z'/><rect x='45' y='32' width='10' height='50'/><path d='M20 90 L80 90 L50 30 Z' opacity='0.2'/></svg>"
              (if (is-eq id u34)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='30' width='60' height='40' rx='2'/><path d='M30 40 L40 50 L30 60' stroke='white' stroke-width='4' fill='none'/><rect x='45' y='55' width='15' height='4' fill='white'/></svg>"
                  (if (is-eq id u35)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='6'><path d='M50 20 L80 80 L20 80 Z'/><circle cx='50' cy='55' r='8' fill='#5546FF'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='20' y='20' width='60' height='60' rx='2' opacity='0.2'/><rect x='25' y='25' width='10' height='10'/><rect x='40' y='25' width='10' height='10'/><rect x='55' y='25' width='10' height='10'/><rect x='25' y='40' width='10' height='10'/><rect x='40' y='40' width='10' height='10' opacity='0.5'/><rect x='55' y='40' width='10' height='10' opacity='0.5'/></svg>"
                  )
              )
          )
      )
  )
)

;; STRATA (IDs 41-49)
(define-private (get-strata (id uint))
  (if (is-eq id u41)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 80 Q 50 60 90 80 L 90 100 L 10 100 Z'/><path d='M10 50 Q 50 30 90 50 L 90 70 Q 50 50 10 70 Z' opacity='0.7'/><path d='M10 20 Q 50 0 90 20 L 90 40 Q 50 20 10 40 Z' opacity='0.4'/></svg>"
      (if (is-eq id u42)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8'><rect x='10' y='70' width='80' height='20'/><rect x='20' y='45' width='60' height='20'/><rect x='30' y='20' width='40' height='20'/></svg>"
          (if (is-eq id u43)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='10' width='80' height='80' rx='40' opacity='0.2'/><rect x='25' y='25' width='50' height='50' rx='25' opacity='0.5'/><rect x='40' y='40' width='20' height='20' rx='10'/></svg>"
              (if (is-eq id u44)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M0 30 Q 50 10 100 30 V 50 Q 50 30 0 50 Z' opacity='0.8'/><path d='M0 50 Q 50 70 100 50 V 70 Q 50 90 0 70 Z' opacity='0.5'/><path d='M0 70 Q 50 50 100 70 V 90 Q 50 70 0 90 Z' opacity='0.2'/></svg>"
                  (if (is-eq id u45)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='3'><path d='M0 20 C 30 10, 70 30, 100 20'/><path d='M0 35 C 40 45, 60 15, 100 35' opacity='0.8'/><path d='M0 50 C 20 60, 80 40, 100 50' opacity='0.6'/><path d='M0 65 C 50 55, 50 75, 100 65' opacity='0.4'/><path d='M0 80 C 30 90, 70 70, 100 80' opacity='0.2'/></svg>"
                      (if (is-eq id u46)
                          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='70' width='20' height='12' rx='2'/><rect x='35' y='68' width='25' height='12' rx='2'/><rect x='65' y='72' width='25' height='12' rx='2'/><rect x='15' y='50' width='30' height='12' rx='2' opacity='0.6'/><rect x='50' y='48' width='30' height='12' rx='2' opacity='0.6'/><rect x='25' y='30' width='20' height='12' rx='2' opacity='0.3'/><rect x='50' y='32' width='25' height='12' rx='2' opacity='0.3'/></svg>"
                          (if (is-eq id u47)
                              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='20' width='35' height='60' rx='2'/><rect x='55' y='20' width='35' height='60' rx='2' opacity='0.5'/><rect x='48' y='25' width='4' height='50' fill='white' opacity='0.2'/></svg>"
                              (if (is-eq id u48)
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M10 20 L40 20 L40 80 L10 80 Z'/><path d='M60 20 L90 20 L90 80 L60 80 Z'/><path d='M10 50 L90 50' stroke='black' stroke-width='10' opacity='0.5'/></svg>"
                                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='10' y='60' width='80' height='20' rx='2'/><circle cx='20' cy='50' r='3'/><circle cx='35' cy='45' r='4'/><circle cx='50' cy='52' r='2'/><circle cx='65' cy='48' r='3'/><circle cx='80' cy='53' r='4'/><rect x='10' y='20' width='80' height='15' opacity='0.3'/></svg>"
                              )
                          )
                      )
                  )
              )
          )
      )
  )
)

;; XTS (IDs 51-56)
(define-private (get-xts (id uint))
  (if (is-eq id u51)
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M20 20 L80 20 L50 50 Z'/><path d='M20 80 L80 80 L50 50 Z' opacity='0.6'/></svg>"
      (if (is-eq id u52)
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><rect x='35' y='10' width='30' height='35' rx='2'/><rect x='35' y='55' width='30' height='35' rx='2' opacity='0.5'/><rect x='20' y='48' width='60' height='4' rx='2'/></svg>"
          (if (is-eq id u53)
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='8'><path d='M20 20 L50 50'/><path d='M80 20 L50 50'/><path d='M20 80 L50 50'/><path d='M80 80 L50 50'/></svg>"
              (if (is-eq id u54)
                  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='#5546FF' stroke-width='4'><path d='M50 10 L50 90 M10 50 L90 50'/><circle cx='50' cy='50' r='20'/><rect x='45' y='45' width='10' height='10' fill='#5546FF'/></svg>"
                  (if (is-eq id u55)
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF'><path d='M50 50 L20 20 L20 40 Z'/><path d='M50 50 L80 20 L80 40 Z' opacity='0.8'/><path d='M50 50 L20 80 L20 60 Z' opacity='0.6'/><path d='M50 50 L80 80 L80 60 Z' opacity='0.4'/></svg>"
                      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='#5546FF' opacity='0.5'><path d='M50 10 L85 80 H15 Z'/><path d='M50 90 L15 20 H85 Z' fill='none' stroke='#5546FF' stroke-width='4'/></svg>"
                  )
              )
          )
      )
  )
)

;; --------------------------------------------------------------------------
;; PUBLIC API
;; --------------------------------------------------------------------------
;; (get-svg id) -> (response (string-utf8 N) uint)
;; (get-svg-data-uri id) -> (response (string-utf8 N) uint)

(define-read-only (get-svg (id uint))
  (let ((svg (get-svg-raw id)))
    (if (is-eq svg none)
        (err ERR-NOT-FOUND)
        (ok (unwrap-panic svg))
    )
  )
)

;; NEW: Option A wrapper - returns a data URI usable as an "image URL"
(define-read-only (get-svg-data-uri (id uint))
  (match (get-svg id)
    svg (ok (concat "data:image/svg+xml;utf8," svg))
    err-code (err err-code)
  )
)

`
