

Can we also, for larger files still make the first chunk initialise and chunk then make the last chunk chunk and seal so we remove unnecessary steps and transactions?

We still need to fully understand the full inscription process and logic to understand why it's only the sealing txn that pops up too quickly and causes a "user cancelled" issue every time but it is not comeing from me - it is something we are doing that makes the wallet want to exit from the transaction until we come back again, it checks for existing chunks and only after this check does it do the correct txn that then goes throiugh . Please work out what is going on and how to fix it.


Report on the readiness of the Smart contract u64bxr for mainnet:

Findings

  - Critical — BatchXR royalties will fail on mainnet because ROYALTY-RECIPIENT is a testnet principal. stx-
    transfer? will abort every batch upload on mainnet unless this is replaced with a valid mainnet address or
    made configurable. assets/index-06f51251-2.js:319 - ***THIS WILL BE CHANGED WHEN DEPLOYING TO MN***

  - High — seal-inscription does not verify that all chunks exist, that total-size matches the uploaded data, or
    that hash/merkle-root corresponds to the stored chunks. This allows sealing empty or corrupt inscriptions and
    undermines on-chain integrity guarantees. assets/index-06f51251-2.js:380 ***HIGH PRIORITY***

  - High — begin-inscription overwrites pending metadata for the same {hash, owner} without clearing any
    previously stored chunks. This can silently corrupt inscriptions or create metadata/chunk mismatches. assets/
    index-06f51251-2.js:348 ***THIS IS A FEATURE SO EXACT FILES CONTINUE WHERE THEY LEFT OFF - If found then button text should be updated to "Resume Inscription for clarity***

  - Medium — chunk-count and total-size are unbounded and not validated for sanity (e.g., chunk-count > 0, total-
    size <= chunk-count * MAX-CHUNK-SIZE). You can seal inscriptions with impossible metadata, which can DoS
    viewers or indexers. assets/index-06f51251-2.js:348, assets/index-06f51251-2.js:380 ***Please suggest a fix***

  - Medium — Royalty is a fixed ROYALTY-FEE per batch (u100000) and does not scale with batch size. If you expect
    proportional fees (e.g., based on chunk count), the contract doesn’t enforce it and the UI can be bypassed by
    direct calls. assets/index-06f51251-2.js:370 ***What can we do to dfix this?***

  - Low — add-chunk bypasses royalties entirely. This is fine if you intend royalties only on batch uploads, but
    it’s a bypass if you want fees on all data writes. assets/index-06f51251-2.js:358 ***we need a well thought out and concise strategy for me adding splits to transactions to earn some royalties***

  - Low — MAX-CHUNK-SIZE is defined but never used to validate chunk size or total size; only type limits are
    enforced. This allows short/empty chunks and inconsistent totals. assets/index-06f51251-2.js:316, assets/
    index-06f51251-2.js:358 ***Chunk size should be set to 64kb only to simplify things***

  Open Questions / Assumptions

  - Is the contract intended to be a simple on-chain storage registry (no integrity guarantees), or should it
    enforce chunk completeness and hash consistency? ***Needs to enforce chunk completeness***
  - Should royalties apply to add-chunk too, or only to add-chunk-batch? ***Whatever makes sense for me to get my cut from transactions***
  - Should royalties scale with batch size (proportional per chunk) rather than a fixed fee? ***Yes that probably makes more sense***
  - Is it acceptable to allow multiple pending inscriptions per {hash, owner} with no explicit abort/cleanup?***There is no way to clean up previously inscribed chunks if they give up but what would you suggest?***

  Readiness Summary

  - As written, u64bxr is not ready for mainnet due to a critical misconfiguration (testnet royalty address) and
    high-severity data integrity gaps. If the goal is a trust-minimized on-chain registry, you should add
    integrity checks and sanity limits before mainnet deployment.

  If you want, I can propose a hardened mainnet-ready version of u64bxr with explicit validation and configurable
  royalty logic.