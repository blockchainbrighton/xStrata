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
;; - If you intend to embed via `data:image/svg+xml;utf8,` some renderers are picky about
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
