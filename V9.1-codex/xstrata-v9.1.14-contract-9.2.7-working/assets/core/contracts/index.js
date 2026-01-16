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
