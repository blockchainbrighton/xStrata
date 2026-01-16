;; u64bxr-v9.2.11: xStrata Optimized Protocol (SIP-009 Compatible)
;; Goals of this refactor:
;; 1) Max wallet/indexer compatibility: implement SIP-009 trait + standard signatures
;; 2) Return a SHORT token-uri (<=256) that points to JSON metadata (most compatible)
;; 3) Keep SVG available on-chain via additional read-only helpers (properly encoded)
;; 4) Avoid SVG pitfalls: no unescaped '#', no utf8-inline data-uri in token-uri

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- SIP-009 TRAIT (IMPLEMENT FOR WALLET/INDEXER COMPATIBILITY) ---
;;
;; Deployed trait contracts (per Stacks docs):
;; - mainnet: SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait
;; - testnet: ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait
;;
;; Deploy target note:
;; - Testnet: keep the testnet impl-trait line active.
;; - Mainnet: comment testnet, uncomment the mainnet impl-trait below.
;; - Clarinet/devnet: use the local .sip009-nft-trait lines (commented below).
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; [DEVNET / CLARINET]
;; (impl-trait .sip009-nft-trait.nft-trait)
;; (use-trait nft-trait .sip009-nft-trait.nft-trait)

(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)
;; [MAINNET]
;; (impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- ASSET DEFINITION ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-non-fungible-token xstrata-inscription uint)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- ERROR CODES ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-FOUND (err u101))
(define-constant ERR-INVALID-BATCH (err u102))
(define-constant ERR-HASH-MISMATCH (err u103))
(define-constant ERR-ALREADY-SEALED (err u104))
(define-constant ERR-METADATA-FROZEN (err u105))
(define-constant ERR-WRONG-INDEX (err u106))
(define-constant ERR-INVALID-URI (err u107))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- CONSTANTS ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT-OWNER tx-sender)
(define-constant MAX-BATCH-SIZE u50)

;; --- ROYALTY CONSTANTS (microSTX) ---
(define-constant ROYALTY-BEGIN u100000)
(define-constant ROYALTY-SEAL-BASE u100000)
(define-constant ROYALTY-SEAL-PER-CHUNK u10000)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- SVG (COMPATIBLE / SAFE) ---
;;
;; IMPORTANT NOTES:
;; - Do NOT return raw SVG data-URIs from get-token-uri if you want maximum wallet compatibility.
;;   Most clients expect token-uri to resolve to JSON metadata.
;; - We keep SVG on-chain via helper functions.
;; - We provide a BASE64-encoded SVG data URI (no '#' fragment truncation issues).
;; - We keep the SVG STATIC (no animateTransform) to maximize renderer/sanitizer compatibility.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant SVG-STATIC
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><circle cx='25' cy='25' r='20' fill='none' stroke='#6366f1' stroke-width='4'/><circle cx='25' cy='25' r='12' fill='none' stroke='#ec4899' stroke-width='4'/></svg>"
)

;; Precomputed base64(SVG-STATIC)
(define-constant SVG-STATIC-B64
  "PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA1MCA1MCc+PGNpcmNsZSBjeD0nMjUnIGN5PScyNScgcj0nMjAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzYzNjZmMScgc3Ryb2tlLXdpZHRoPSc0Jy8+PGNpcmNsZSBjeD0nMjUnIGN5PScyNScgcj0nMTInIGZpbGw9J25vbmUnIHN0cm9rZT0nI2VjNDg5OScgc3Ryb2tlLXdpZHRoPSc0Jy8+PC9zdmc+"
)

(define-constant SVG-DATAURI-PREFIX "data:image/svg+xml;base64,")

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- DATA VARS ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var next-id uint u0)
(define-data-var royalty-recipient principal tx-sender)

;; Token URIs are stored per-id to avoid unsupported uint -> string conversion.
;; The client should pass the full token-uri string at seal time.
(define-map TokenURIs uint (string-ascii 256))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- STORAGE ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

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
(define-map Chunks { context: (buff 32), index: uint } (buff 16384))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- SIP-009 REQUIRED FUNCTIONS ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (get-last-token-id)
  ;; Avoid underflow when next-id == 0
  (if (is-eq (var-get next-id) u0)
    (ok u0)
    (ok (- (var-get next-id) u1))
  )
)

;; Return the stored token-uri (client-provided at seal time).
(define-read-only (get-token-uri (id uint))
  (if (is-some (nft-get-owner? xstrata-inscription id))
    (ok (map-get? TokenURIs id))
    (ok none)
  )
)

(define-read-only (get-owner (id uint))
  (ok (nft-get-owner? xstrata-inscription id))
)

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

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- OPTIONAL READ-ONLY HELPERS (ON-CHAIN SVG ACCESS) ---
;;
;; These are NOT part of SIP-009, but help your own renderer/dapp and advanced clients.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Raw SVG (static)
(define-read-only (get-svg (id uint))
  (if (is-some (nft-get-owner? xstrata-inscription id))
    (ok (some SVG-STATIC))
    (ok none)
  )
)

;; Data URI (base64) - safe for URI parsers (no '#'-fragment truncation)
(define-read-only (get-svg-data-uri (id uint))
  (if (is-some (nft-get-owner? xstrata-inscription id))
    (ok (some (concat SVG-DATAURI-PREFIX SVG-STATIC-B64)))
    (ok none)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- ADMIN FUNCTIONS ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (set-royalty-recipient (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set royalty-recipient recipient)
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- CORE LOGIC (UNCHANGED BEHAVIOR) ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

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
      { idx: start-idx, run-hash: start-hash, target-hash: hash })))
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
    { idx: (+ current-idx u1), run-hash: next-hash, target-hash: target-hash }
  )
)

(define-private (seal-internal (expected-hash (buff 32)) (token-uri-string (string-ascii 256)) (new-id uint))
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
    (map-set TokenURIs new-id token-uri-string)

    (map-delete UploadState { owner: tx-sender, hash: expected-hash })
    (var-set next-id (+ new-id u1))
    (ok new-id)
  )
)

;; Token-uri string is required for SIP-009-compatible metadata lookups.
(define-public (seal-inscription (expected-hash (buff 32)) (token-uri-string (string-ascii 256)))
  (seal-internal expected-hash token-uri-string (var-get next-id))
)

(define-public (seal-recursive (expected-hash (buff 32)) (token-uri-string (string-ascii 256)) (dependencies (list 50 uint)))
  (let ((id (var-get next-id)))
    (map-insert InscriptionDependencies id dependencies)
    (seal-internal expected-hash token-uri-string id)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; --- READERS ---
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

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
