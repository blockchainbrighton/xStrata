;; u64bxr-sequential-v2: xStrata High-Throughput Protocol
;; Version: v11.3 (patched: V2 Dependencies + Cross-Contract Verification)

;; --- TRAIT DEFINITIONS ---
(impl-trait .sip009-nft-trait.nft-trait)
(use-trait nft-trait .sip009-nft-trait.nft-trait)

;; NEW: Trait definition for compatible external inscription contracts
(define-trait inscription-lookup-trait
  (
    (get-inscription (uint) (response (optional { owner: principal, mime-type: (string-ascii 64), total-size: uint, chunk-count: uint, final-hash: (buff 32) }) uint))
  )
)

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

;; NEW: Error for external dependency failures
(define-constant ERR-DEPENDENCY-CALL-FAILED (err u114))

;; --- CONFIGURATION ---
(define-constant MAX-CHUNK-SIZE u16384)
(define-constant MAX-CHUNK-COUNT u4096)
(define-constant PENDING_TTL u2100) ;; ~2 weeks

;; --- OWNERSHIP & FEES ---
(define-data-var contract-owner principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X)
(define-data-var royalty-recipient principal 'STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X)
(define-data-var royalty-fee-per-chunk uint u10000)
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

;; Legacy (V1) Same-contract dependencies
(define-map InscriptionDependencies uint (list 200 uint))

;; NEW (V2): Cross-Contract Dependencies
;; Stores the specific contract principal and ID for every dependency.
(define-map InscriptionDependenciesV2 
  uint 
  (list 200 { contract: principal, id: uint })
)

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

;; NEW: Helper to securely get "this" contract's principal.
;; Wrapping 'as-contract' here bypasses parser restrictions in 'let' bindings.
(define-private (get-self)
  (as-contract tx-sender)
)

(define-public (set-contract-owner (new-owner principal))
  (begin (try! (assert-contract-owner)) (var-set contract-owner new-owner) (ok true))
)

(define-public (set-royalty-recipient (recipient principal))
  (begin (try! (assert-contract-owner)) (var-set royalty-recipient recipient) (ok true))
)

(define-public (set-royalty-fee-per-chunk (fee uint))
  (begin (try! (assert-contract-owner)) (var-set royalty-fee-per-chunk fee) (ok true))
)

(define-public (set-fee-per-chunk (fee uint))
  (set-royalty-fee-per-chunk fee)
)

(define-public (set-begin-fee (fee uint))
  (begin (try! (assert-contract-owner)) (var-set begin-fee fee) (ok true))
)

(define-public (set-base-uri (uri (string-ascii 210)))
  (begin (try! (assert-contract-owner)) (var-set base-uri uri) (ok true))
)

;; --- SIP-009 FUNCTIONS ---

(define-read-only (get-last-token-id)
  (ok (- (var-get next-id) u1))
)

(define-read-only (get-token-uri (id uint))
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

(define-public (begin-inscription
  (expected-hash (buff 32))
  (mime (string-ascii 64))
  (total-size uint)
  (chunk-count uint)
)
  (begin-inscription-to expected-hash mime total-size chunk-count tx-sender)
)

(define-public (begin-inscription-to
  (expected-hash (buff 32))
  (mime (string-ascii 64))
  (total-size uint)
  (chunk-count uint)
  (recipient principal)
)
  (let ((id (var-get next-id)))
    (asserts! (and (> chunk-count u0) (<= chunk-count MAX-CHUNK-COUNT)) ERR-INVALID-META)
    (try! (pay-fee (var-get begin-fee)))

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
    (asserts! (<= burn-block-height (get expires-at meta)) ERR-EXPIRED)
    (asserts! (is-eq (get owner meta) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (< next-idx (get chunk-count meta)) ERR-WRONG-INDEX)
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
  (fold batch-step chunks (ok id))
)

(define-private (batch-step (data (buff 16384)) (result (response uint uint)))
  (match result
    cur-id (begin (try! (add-chunk cur-id data)) (ok cur-id))
    err-code (err err-code)
  )
)

;; --- DEPENDENCY VALIDATION (V1 & V2) ---

;; V1: Legacy same-contract validation
(define-private (deps-step (dep uint) (acc (response uint uint)))
  (match acc
    id (begin
         (asserts! (not (is-eq dep id)) ERR-SELF-DEPENDENCY)
         (asserts! (is-some (map-get? Inscriptions dep)) ERR-DEPENDENCY-NOT-SEALED)
         (ok id))
    err-code (err err-code)
  )
)

;; NEW V2: Cross-Contract Validation Helper
(define-private (verify-dep-v2 
  (dep { contract: principal, id: uint }) 
  (state (response { self: principal, origin: uint } uint))
)
  (match state
    ctx 
      (let (
        (self (get self ctx))
        (origin (get origin ctx))
        (target (get contract dep))
        (target-id (get id dep))
      )
        ;; 1. Self-Reference Check
        ;; Must not depend on the exact same inscription being minted
        (asserts! (not (and (is-eq target self) (is-eq target-id origin))) ERR-SELF-DEPENDENCY)

        ;; 2. Seal Status Verification
        (if (is-eq target self)
          ;; Case A: Local Dependency
          (asserts! (is-some (map-get? Inscriptions target-id)) ERR-DEPENDENCY-NOT-SEALED)
          
          ;; Case B: External Dependency
          ;; Warning: Dynamic dispatch on a 'principal' variable is restricted in Mainnet Clarity.
          ;; This implementation works in simulated/test environments or if 'target' is a valid trait.
          (match (contract-call? target get-inscription target-id)
            opt (asserts! (is-some opt) ERR-DEPENDENCY-NOT-SEALED)
            err ERR-DEPENDENCY-CALL-FAILED
          )
        )
        ;; Pass context to next iteration
        (ok ctx)
      )
    prev-err (err prev-err)
  )
)

(define-public (seal-inscription (id uint))
  (let ((meta (unwrap! (map-get? PendingInscriptions id) ERR-NOT-FOUND)))
    (asserts! (<= burn-block-height (get expires-at meta)) ERR-EXPIRED)
    (asserts! (is-eq (get owner meta) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get current-index meta) (get chunk-count meta)) ERR-NOT-COMPLETE)
    (asserts! (is-eq (get current-hash meta) (get expected-hash meta)) ERR-HASH-MISMATCH)

    (try! (pay-fee (* (var-get royalty-fee-per-chunk) (get chunk-count meta))))
    (try! (nft-mint? xstrata-inscription id (get recipient meta)))

    (map-insert Inscriptions id {
      owner: (get recipient meta),
      mime-type: (get mime-type meta),
      total-size: (get total-size meta),
      chunk-count: (get chunk-count meta),
      final-hash: (get expected-hash meta)
    })

    (map-delete PendingInscriptions id)
    (ok id)
  )
)

;; Legacy Recursive Seal (V1)
(define-public (seal-recursive (id uint) (dependencies (list 200 uint)))
  (begin
    (try! (fold deps-step dependencies (ok id)))
    (map-insert InscriptionDependencies id dependencies)
    (seal-inscription id)
  )
)

;; NEW (V2): Cross-Contract Recursive Seal
;; Accepts a list of (contract, id) tuples.
(define-public (seal-recursive-v2 
  (id uint) 
  (dependencies (list 200 { contract: principal, id: uint }))
)
  ;; FIX: Use private helper (get-self) to resolve principal.
  ;; This avoids "unresolved function 'as-contract'" errors in let-bindings.
  (let ((self (get-self)))
    (begin
      ;; Verify dependencies
      (try! (fold verify-dep-v2 dependencies (ok { self: self, origin: id })))

      ;; Store the V2 dependency list
      (map-insert InscriptionDependenciesV2 id dependencies)

      ;; Finalize seal
      (seal-inscription id)
    )
  )
)

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

;; NEW: Reader for V2 dependencies
(define-read-only (get-dependencies-v2 (id uint))
  (default-to (list) (map-get? InscriptionDependenciesV2 id))
)