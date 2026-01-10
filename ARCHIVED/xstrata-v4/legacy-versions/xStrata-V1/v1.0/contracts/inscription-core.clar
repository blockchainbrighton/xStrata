(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u8192)

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

(define-map Chunks { context: (buff 32), index: uint } (buff 8192))

(define-public (begin-inscription (hash (buff 32)) (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (begin
        (map-set PendingInscriptions { hash: hash, owner: tx-sender } {
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count
        })
        (ok true)
    ))

(define-public (add-chunk (hash (buff 32)) (index uint) (data (buff 8192)))
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
