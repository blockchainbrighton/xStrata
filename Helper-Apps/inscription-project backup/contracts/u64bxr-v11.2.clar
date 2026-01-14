;; u64bxr-sequential-v2: xStrata High-Throughput Protocol
;; Version: v11.2 (patched: TTL + begin/seal fees + mint-to + overwrite protection + dep checks + stable owner)

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
(define-constant ERR-INVALID-META (err u108))

(define-constant ERR-EXPIRED (err u109))
(define-constant ERR-SELF-DEPENDENCY (err u110))
(define-constant ERR-DEPENDENCY-NOT-SEALED (err u111))
(define-constant ERR-NOT-EXPIRED (err u112))
(define-constant ERR-CHUNK-ALREADY-SET (err u113))

;; --- CONFIGURATION ---
(define-constant MAX-CHUNK-SIZE u16384)
(define-constant MAX-CHUNK-COUNT u4096)

;; ~2 weeks (per your spec)
(define-constant PENDING_TTL u2100)

;; --- OWNERSHIP & FEES ---
;; IMPORTANT: stable owner principal (do NOT use tx-sender as a constant)
(define-data-var contract-owner principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X)

(define-data-var royalty-recipient principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X)

;; Backward compatible name kept; used as the seal fee-per-chunk
(define-data-var royalty-fee-per-chunk uint u10000)

;; New: begin fee (anti-spam / storage pressure)
(define-data-var begin-fee uint u0)

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

;; Same-contract dependencies for v11.2 (list of inscription IDs)
(define-map InscriptionDependencies uint (list 200 uint))

(define-map PendingInscriptions
  uint
  {
    owner: principal,
    recipient: principal,
    expected-hash: (buff 32),
    current-hash: (buff 32),
    current-index: uint,
    chunk-count: uint,
    mime-type: (string-ascii 64),
    total-size: uint,
    started-at: uint,
    expires-at: uint
  }
)

(define-map Chunks { id: uint, index: uint } (buff 16384))

;; --- MARKETPLACE APPROVALS ---
(define-map TokenApprovals uint principal)
(define-map OperatorApprovals { owner: principal, operator: principal } bool)

;; --- ADMIN HELPERS ---

(define-private (assert-contract-owner)
  (if (is-eq tx-sender (var-get contract-owner)) (ok true) ERR-NOT-AUTHORIZED)
)

(define-private (pay-fee (amount uint))
  (if (> amount u0)
      (stx-transfer? amount tx-sender (var-get royalty-recipient))
      (ok true))
)

(define-public (set-contract-owner (new-owner principal))
  (begin
    (try! (assert-contract-owner))
    (var-set contract-owner new-owner)
    (ok true)
  )
)

(define-public (set-royalty-recipient (recipient principal))
  (begin
    (try! (assert-contract-owner))
    (var-set royalty-recipient recipient)
    (ok true)
  )
)

;; Backward-compatible setter name (still valid)
(define-public (set-royalty-fee-per-chunk (fee uint))
  (begin
    (try! (assert-contract-owner))
    (var-set royalty-fee-per-chunk fee)
    (ok true)
  )
)

;; Preferred naming (wrapper)
(define-public (set-fee-per-chunk (fee uint))
  (set-royalty-fee-per-chunk fee)
)

(define-public (set-begin-fee (fee uint))
  (begin
    (try! (assert-contract-owner))
    (var-set begin-fee fee)
    (ok true)
  )
)

(define-public (set-base-uri (uri (string-ascii 210)))
  (begin
    (try! (assert-contract-owner))
    (var-set base-uri uri)
    (ok true)
  )
)

;; --- SIP-009 FUNCTIONS ---

(define-read-only (get-last-token-id)
  (ok (- (var-get next-id) u1))
)

(define-read-only (get-token-uri (id uint))
  ;; Many marketplaces expect (some "base-uri"), often concatenated off-chain.
  (ok (some (var-get base-uri)))
)

(define-read-only (get-owner (id uint))
  (ok (nft-get-owner? xstrata-inscription id))
)

(define-read-only (is-approved (owner principal) (id uint))
  (or
    (is-eq (map-get? TokenApprovals id) (some contract-caller))
    (default-to false (map-get? OperatorApprovals { owner: owner, operator: contract-caller }))
  )
)

(define-public (set-approved (id uint) (operator principal) (approved bool))
  (begin
    (asserts! (is-eq (some contract-caller) (nft-get-owner? xstrata-inscription id)) ERR-NOT-OWNER)
    (if approved
        (map-set TokenApprovals id operator)
        (map-delete TokenApprovals id))
    (ok true)
  )
)

(define-public (set-approval-for-all (owner principal) (operator principal) (approved bool))
  (begin
    (asserts! (is-eq contract-caller owner) ERR-NOT-AUTHORIZED)
    (if approved
        (map-set OperatorApprovals { owner: owner, operator: operator } true)
        (map-delete OperatorApprovals { owner: owner, operator: operator }))
    (ok true)
  )
)

(define-public (transfer (id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq (some sender) (nft-get-owner? xstrata-inscription id)) ERR-NOT-OWNER)
    (asserts! (or (is-eq contract-caller sender) (is-approved sender id)) ERR-NOT-AUTHORIZED)
    (try! (nft-transfer? xstrata-inscription id sender recipient))
    (map-delete TokenApprovals id)
    (ok true)
  )
)

;; --- CORE LOGIC ---

;; Compatibility wrapper: mint to self
(define-public (begin-inscription
  (expected-hash (buff 32))
  (mime (string-ascii 64))
  (total-size uint)
  (chunk-count uint)
)
  (begin-inscription-to expected-hash mime total-size chunk-count tx-sender)
)

;; New: mint-to recipient; only the starter can upload/seal
(define-public (begin-inscription-to
  (expected-hash (buff 32))
  (mime (string-ascii 64))
  (total-size uint)
  (chunk-count uint)
  (recipient principal)
)
  (let ((id (var-get next-id)))
    (asserts! (and (> chunk-count u0) (<= chunk-count MAX-CHUNK-COUNT)) ERR-INVALID-META)

    ;; Begin fee (anti-spam). Paid only if user starts successfully.
    (try! (pay-fee (var-get begin-fee)))

    ;; mime-type is stored but can be empty. No whitelist.
    (map-set PendingInscriptions id {
      owner: tx-sender,
      recipient: recipient,
      expected-hash: expected-hash,
      current-hash: 0x,
      current-index: u0,
      chunk-count: chunk-count,
      mime-type: mime,
      total-size: total-size,
      started-at: burn-block-height,
      expires-at: (+ burn-block-height PENDING_TTL)

    })

    (var-set next-id (+ id u1))
    (ok id)
  )
)

(define-public (add-chunk (id uint) (data (buff 16384)))
  (let (
    (meta (unwrap! (map-get? PendingInscriptions id) ERR-NOT-FOUND))
    (next-idx (get current-index meta))
    (new-hash (sha256 (concat (get current-hash meta) data)))
  )
    ;; TTL
    (asserts! (<= burn-block-height (get expires-at meta)) ERR-EXPIRED)

    ;; Only starter wallet can add + seal
    (asserts! (is-eq (get owner meta) tx-sender) ERR-NOT-AUTHORIZED)

    ;; Fixed chunk-count at begin
    (asserts! (< next-idx (get chunk-count meta)) ERR-WRONG-INDEX)

    ;; No overwrites - only fill missing
    (asserts! (is-none (map-get? Chunks { id: id, index: next-idx })) ERR-CHUNK-ALREADY-SET)

    (map-set Chunks { id: id, index: next-idx } data)

    (map-set PendingInscriptions id (merge meta {
      current-index: (+ next-idx u1),
      current-hash: new-hash
    }))

    (ok true)
  )
)

(define-public (add-chunk-batch (id uint) (chunks (list 20 (buff 16384))))
  ;; Fold over add-chunk; tx-sender remains the same.
  (fold batch-step chunks (ok id))
)

(define-private (batch-step (data (buff 16384)) (result (response uint uint)))
  (match result
    cur-id (begin (try! (add-chunk cur-id data)) (ok cur-id))
    err-code (err err-code)
  )
)

(define-private (deps-step (dep uint) (acc (response uint uint)))
  (match acc
    id (begin
         (asserts! (not (is-eq dep id)) ERR-SELF-DEPENDENCY)
         (asserts! (is-some (map-get? Inscriptions dep)) ERR-DEPENDENCY-NOT-SEALED)
         (ok id))
    err-code (err err-code)
  )
)

(define-public (seal-inscription (id uint))
  (let ((meta (unwrap! (map-get? PendingInscriptions id) ERR-NOT-FOUND)))
    ;; TTL
    (asserts! (<= burn-block-height (get expires-at meta)) ERR-EXPIRED)

    ;; Only starter wallet can seal
    (asserts! (is-eq (get owner meta) tx-sender) ERR-NOT-AUTHORIZED)

    ;; Must have all chunks
    (asserts! (is-eq (get current-index meta) (get chunk-count meta)) ERR-NOT-COMPLETE)

    ;; Commitment check (rolling hash scheme)
    (asserts! (is-eq (get current-hash meta) (get expected-hash meta)) ERR-HASH-MISMATCH)

    ;; Seal fee paid on completion
    (try! (pay-fee (* (var-get royalty-fee-per-chunk) (get chunk-count meta))))

    ;; Mint NFT to recipient specified at begin
    (try! (nft-mint? xstrata-inscription id (get recipient meta)))

    ;; Seal inscription metadata
    (map-insert Inscriptions id {
      owner: (get recipient meta),
      mime-type: (get mime-type meta),
      total-size: (get total-size meta),
      chunk-count: (get chunk-count meta),
      final-hash: (get expected-hash meta)
    })

    ;; Remove pending entry point (orphaned chunks may remain; indexers ignore)
    (map-delete PendingInscriptions id)

    (ok id)
  )
)

(define-public (seal-recursive (id uint) (dependencies (list 200 uint)))
  (begin
    ;; Validate deps cheaply: must be sealed + cannot reference self
    (try! (fold deps-step dependencies (ok id)))

    (map-insert InscriptionDependencies id dependencies)
    (seal-inscription id)
  )
)

;; Expire pending inscriptions after TTL.
;; Note: this removes the pending entry point; chunk cleanup (deleting many map entries)
;; is intentionally not forced in one tx.
(define-public (expire-pending (id uint))
  (match (map-get? PendingInscriptions id)
    meta
      (begin
        (asserts! (> burn-block-height (get expires-at meta)) ERR-NOT-EXPIRED)
        (map-delete PendingInscriptions id)
        (ok true))
    (ok false)
  )
)

;; --- READERS ---

(define-read-only (get-inscription (id uint))
  (map-get? Inscriptions id)
)

(define-read-only (get-pending (id uint))
  (map-get? PendingInscriptions id)
)

(define-read-only (get-chunk (id uint) (index uint))
  (map-get? Chunks { id: id, index: index })
)

(define-read-only (get-dependencies (id uint))
  (default-to (list) (map-get? InscriptionDependencies id))
)
