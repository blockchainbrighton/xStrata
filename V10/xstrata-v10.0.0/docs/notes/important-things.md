# important-things.md

## Purpose of This Document

This document captures **non-negotiable principles and priorities** for this Stacks inscription application.

It exists to guide future development, refactoring decisions, and AI-assisted work **without breaking core assumptions** or degrading user experience, cost efficiency, or protocol integrity.

This is not an implementation spec.
It is a statement of **what must remain true**.

---

## Core Principles

### 1. The Inscription Process Is Sacred

The primary purpose of this system is to **inscribe data onto Bitcoin (via Stacks)** in a reliable, efficient, and user-controlled way.

This includes:
- Correct chunking of large data
- Correct batching and ordering of chunks
- Correct sealing / finalization of inscriptions
- Full and correct handling of SIP-009 NFT semantics where applicable

Any future change **must preserve correctness of inscriptions first**, even if it complicates UI or developer ergonomics.

---

## Chunking, Batching, and Sealing

### Chunking
- Large data **must be split into chunks** suitable for inscription.
- Chunk size and structure should prioritize:
  - Reliability
  - Gas efficiency
  - Predictable processing

### Batching
- Chunks should be **batched and processed sequentially**.
- The system should minimize on-chain computation during batching.
- Wherever possible, batching logic should live **off-chain (client-side)**.

### Sealing
- Seal / finalize transactions must be handled explicitly and correctly.
- A completed inscription must be:
  - Verifiable
  - Immutable
  - Clearly distinguishable from incomplete attempts

---

## Gas Efficiency Is a First-Class Concern

Every interaction with the chain:
- costs money,
- creates friction,
- and affects scalability.

Therefore:
- All blockchain interactions must attempt to be **as efficient as reasonably possible**.
- Avoid unnecessary hashing, repeated computation, or excessive contract calls.
- Prefer **client-side state, local memory, and deterministic processes** over on-chain monitoring during active inscription.

Efficiency is not optional — it is part of the user experience.

---

## Long-Running, Automated Inscription Sessions

### “Press Go” Experience

The system should support a mode where users can:
- Prepare an inscription
- Explicitly accept the cost and risk
- Press **Go**
- Allow the system to process transactions automatically over time (e.g. ~20 minutes)

During this process:
- Wallet approvals may occur repeatedly
- Transactions should proceed in an orderly, deterministic sequence
- The system should take over execution once consent is given

If the process fails:
- The failure should be explicit
- Partial results should be clearly understood
- The system must never silently duplicate work

---

## Failure, Recovery, and Never Re-Inscribing Data

### Crash & Recovery
- Users must be able to **resume work quickly** after:
  - browser crashes
  - wallet interruptions
  - transaction failures

### No Duplicate Inscription
- The system should **never force users to re-inscribe the same data unnecessarily**.
- Wherever possible:
  - progress should be tracked locally
  - previously inscribed chunks should be recognised and reused

### Contract Awareness (With Limits)
- Ideally, the contract can recognise:
  - incomplete inscriptions
  - which chunks exist
- However:
  - if this requires heavy hashing or complex on-chain computation,
    **it should be avoided**

Pragmatic rule:
> Prefer simpler UX and lower gas costs over perfect on-chain bookkeeping.

---

## Time-Bound Inscriptions

It is acceptable — and often preferable — to define **time-bounded inscription attempts**.

For example:
- An inscription attempt may be valid for ~24 hours
- After that, incomplete state may be discarded or ignored
- Re-inscription after expiry may require starting again

This trades absolute recovery for:
- Simpler contracts
- Lower gas usage
- Clear user expectations

---

## Monitoring Without Chain Pressure

During an active inscription:
- Progress monitoring should rely on:
  - local state
  - browser storage
  - deterministic sequencing
- The chain should **not** be used as a live monitoring system.

On-chain state should be:
- minimal
- authoritative only once inscriptions are complete

---

## SIP-009 Compliance

Where NFTs are involved:
- SIP-009 must be **fully and correctly implemented**
- Ownership, metadata, and token identity must behave exactly as expected
- Any shortcuts or optimizations must **not break SIP-009 semantics**

---

## User Experience Over Perfection

This system prioritizes:
- Users getting their data inscribed
- Predictable costs
- Clear outcomes

It does **not** require:
- perfect recovery in every edge case
- maximum on-chain introspection
- overly complex contracts

When forced to choose:
> Prefer reliability, clarity, and efficiency over theoretical completeness.

---

## Final Note

Any contributor — human or AI — working on this codebase should treat this document as **contextual ground truth**.

If a proposed change violates these principles, it should be reconsidered, constrained, or rejected.
