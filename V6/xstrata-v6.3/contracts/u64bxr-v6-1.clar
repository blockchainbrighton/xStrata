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
;; Default Token URI: On-Chain Data URI (Name: xStrata, Icon: Blue Circle)
(define-data-var token-uri (string-ascii 256) "data:application/json;base64,eyJuYW1lIjoieFN0cmF0YSIsImltYWdlIjoiZGF0YTppbWFnZS9zdmcreG1sLDxzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB2aWV3Qm94PScwIDAgMTAwIDEwMCc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDUnIGZpbGw9JyUyMzQwODBGRicvPjwvc3ZnPiJ9")

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
            none)))