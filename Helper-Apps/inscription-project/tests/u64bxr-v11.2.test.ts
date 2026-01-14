import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const contract = `${deployer}.u64bxr-v11-2`;

// Helpers
function beginInscriptionTo(sender: string, recipient: string, expectedHash: string, mime: string, size: number, chunks: number) {
  return simnet.callPublicFn(
    contract,
    "begin-inscription-to",
    [
      Cl.bufferFromHex(expectedHash),
      Cl.stringAscii(mime),
      Cl.uint(size),
      Cl.uint(chunks),
      Cl.standardPrincipal(recipient)
    ],
    sender
  );
}

function addChunk(sender: string, id: number, chunkData: string) {
  return simnet.callPublicFn(
    contract,
    "add-chunk",
    [
      Cl.uint(id),
      Cl.bufferFromHex(chunkData)
    ],
    sender
  );
}

function sealInscription(sender: string, id: number) {
  return simnet.callPublicFn(
    contract,
    "seal-inscription",
    [Cl.uint(id)],
    sender
  );
}

function sealRecursive(sender: string, id: number, deps: number[]) {
  return simnet.callPublicFn(
    contract,
    "seal-recursive",
    [
      Cl.uint(id),
      Cl.list(deps.map(d => Cl.uint(d)))
    ],
    sender
  );
}

function getInscription(id: number) {
  return simnet.callReadOnlyFn(
    contract,
    "get-inscription",
    [Cl.uint(id)],
    deployer
  );
}

function getOwner(id: number) {
  return simnet.callReadOnlyFn(
    contract,
    "get-owner",
    [Cl.uint(id)],
    deployer
  );
}

describe("u64bxr-v11.2 Audit Tests", () => {
  
  it("Happy Path: Begin -> Add -> Seal", () => {
    // ID 0
    const expectedHash = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    
    const begin = beginInscriptionTo(wallet1, wallet1, expectedHash, "text/plain", 1, 1);
    expect(begin.result).toBeOk(Cl.uint(0));
    
    const add = addChunk(wallet1, 0, "00");
    expect(add.result).toBeOk(Cl.bool(true));
    
    const seal = sealInscription(wallet1, 0);
    expect(seal.result).toBeOk(Cl.uint(0));
    
    const owner = getOwner(0);
    expect(owner.result).toBeOk(Cl.some(Cl.standardPrincipal(wallet1)));
    
    const data = getInscription(0);
    expect(data.result).toBeSome(Cl.tuple({
      "owner": Cl.standardPrincipal(wallet1),
      "mime-type": Cl.stringAscii("text/plain"),
      "total-size": Cl.uint(1),
      "chunk-count": Cl.uint(1),
      "final-hash": Cl.bufferFromHex(expectedHash)
    }));
  });

  it("Mint to different recipient", () => {
    // ID 0 (State reset)
    const expectedHash = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    const begin = beginInscriptionTo(wallet1, wallet2, expectedHash, "text/plain", 1, 1);
    expect(begin.result).toBeOk(Cl.uint(0)); 
    
    const add = addChunk(wallet1, 0, "00"); // Wallet1 uploads
    expect(add.result).toBeOk(Cl.bool(true));
    
    const seal = sealInscription(wallet1, 0); // Wallet1 seals
    expect(seal.result).toBeOk(Cl.uint(0));
    
    // But Wallet2 owns it
    const owner = getOwner(0);
    expect(owner.result).toBeOk(Cl.some(Cl.standardPrincipal(wallet2)));
  });

  it("Prevents unauthorized access", () => {
    const expectedHash = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    // ID 0
    beginInscriptionTo(wallet1, wallet1, expectedHash, "text/plain", 1, 1);
    
    // Wallet2 tries to add chunk
    const addFail = addChunk(wallet2, 0, "00");
    expect(addFail.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    
    addChunk(wallet1, 0, "00"); // Correct user adds
    
    // Wallet2 tries to seal
    const sealFail = sealInscription(wallet2, 0);
    expect(sealFail.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
  });

  it("Validates Hash Mismatch", () => {
    const expectedHash = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    // ID 0
    beginInscriptionTo(wallet1, wallet1, expectedHash, "text/plain", 1, 1);
    
    // Send wrong data (01 instead of 00)
    addChunk(wallet1, 0, "01");
    
    const sealFail = sealInscription(wallet1, 0);
    expect(sealFail.result).toBeErr(Cl.uint(104)); // ERR-HASH-MISMATCH
  });

  it("Validates Incomplete Chunks", () => {
    const expectedHash = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
    // ID 0, expect 2 chunks
    beginInscriptionTo(wallet1, wallet1, expectedHash, "text/plain", 2, 2);
    
    addChunk(wallet1, 0, "00");
    // Missing second chunk
    
    const sealFail = sealInscription(wallet1, 0);
    expect(sealFail.result).toBeErr(Cl.uint(105)); // ERR-NOT-COMPLETE
  });

  it("Protects against overwriting chunks", () => {
    // ID 0
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    
    // First add
    const add1 = addChunk(wallet1, 0, "00");
    expect(add1.result).toBeOk(Cl.bool(true));
    
    // Try adding again (calls add-chunk, which increments index)
    // Since chunk-count is 1, next index is 1.
    // add-chunk checks: (< next-idx (get chunk-count meta))
    // 1 < 1 is false. So ERR-WRONG-INDEX.
    
    const add2 = addChunk(wallet1, 0, "00");
    expect(add2.result).toBeErr(Cl.uint(103)); // ERR-WRONG-INDEX
  });

  it("Recursive Seal: Dependencies", () => {
    // ID 0
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    addChunk(wallet1, 0, "00");
    sealInscription(wallet1, 0);
    
    // ID 1
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    addChunk(wallet1, 1, "00");
    sealInscription(wallet1, 1);
    
    // ID 2 depends on 0 and 1
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    addChunk(wallet1, 2, "00");
    
    // Seal with deps
    const seal = sealRecursive(wallet1, 2, [0, 1]);
    expect(seal.result).toBeOk(Cl.uint(2));
    
    // Verify Deps
    const deps = simnet.callReadOnlyFn(contract, "get-dependencies", [Cl.uint(2)], deployer);
    expect(deps.result).toBeList([Cl.uint(0), Cl.uint(1)]);
  });

  it("Recursive Seal: Fails on Self-Dependency or Unsealed", () => {
    // ID 0
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    addChunk(wallet1, 0, "00");
    
    // Self-dep check
    const selfDep = sealRecursive(wallet1, 0, [0]);
    expect(selfDep.result).toBeErr(Cl.uint(110)); // ERR-SELF-DEPENDENCY
    
    // Unsealed check
    // ID 1 is unsealed (doesn't exist yet, or just start it)
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    // ID 1 started but not sealed
    
    const unsealedDep = sealRecursive(wallet1, 0, [1]);
    expect(unsealedDep.result).toBeErr(Cl.uint(111)); // ERR-DEPENDENCY-NOT-SEALED
  });

  it("Expiration works", () => {
    // ID 0
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    
    // Try to expire immediately (should fail)
    const expireTooSoon = simnet.callPublicFn(contract, "expire-pending", [Cl.uint(0)], wallet1);
    expect(expireTooSoon.result).toBeErr(Cl.uint(112)); // ERR-NOT-EXPIRED
    
    // Advance chain by 2101 blocks (TTL is 2100)
    simnet.mineEmptyBlocks(2101);
    
    // Try to add chunk (should fail expired)
    const addExpired = addChunk(wallet1, 0, "00");
    expect(addExpired.result).toBeErr(Cl.uint(109)); // ERR-EXPIRED
    
    // Expire it (anyone can call)
    const expireNow = simnet.callPublicFn(contract, "expire-pending", [Cl.uint(0)], wallet2);
    expect(expireNow.result).toBeOk(Cl.bool(true));
    
    // Verify it's gone from pending
    const pending = simnet.callReadOnlyFn(contract, "get-pending", [Cl.uint(0)], deployer);
    expect(pending.result).toBeNone();
  });

  it("Fees: Transfers royalty fee on seal", () => {
    // ID 0
    // chunk count 1 -> fee should be 1 * 10000 = 10000
    beginInscriptionTo(wallet1, wallet1, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d", "text/plain", 1, 1);
    addChunk(wallet1, 0, "00");
    
    // Get balances before seal
    const recipient = "STNRA47CQGS61HQNCBZMVF2HHT7AKZCP2FTE6B5X"; // defined in contract as royalty-recipient
    const balanceBefore = simnet.getAssetsMap().get("STX")?.get(recipient) || 0n;
    
    const seal = sealInscription(wallet1, 0);
    expect(seal.result).toBeOk(Cl.uint(0));
    
    // Get balances after seal
    const balanceAfter = simnet.getAssetsMap().get("STX")?.get(recipient) || 0n;
    
    // Check difference
    // 10000 uSTX
    expect(balanceAfter - balanceBefore).toBe(10000n);
  });
});