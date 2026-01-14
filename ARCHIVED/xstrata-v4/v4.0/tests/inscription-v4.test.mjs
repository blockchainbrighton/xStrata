
import { describe, it, expect, beforeEach } from 'vitest';
import { initSimnet } from '@hirosystems/clarinet-sdk';
import { sha256 } from 'js-sha256';
import { 
    bufferCV, 
    stringAsciiCV, 
    uintCV, 
    listCV, 
    tupleCV, 
    boolCV,
    cvToValue,
    ClarityType
} from '@stacks/transactions';

const simnet = await initSimnet();

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer');
const wallet1 = accounts.get('wallet_1');

// MERKLE HELPERS
// ... (keep existing helpers)

function hashPair(a, b) {
    const concat = new Uint8Array(a.length + b.length);
    concat.set(a);
    concat.set(b, a.length);
    return new Uint8Array(sha256.array(concat));
}

function getMerkleRoot(chunks) {
    let level = chunks.map(c => new Uint8Array(sha256.array(c)));
    while (level.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = (i + 1 < level.length) ? level[i + 1] : left;
            nextLevel.push(hashPair(left, right));
        }
        level = nextLevel;
    }
    return level[0];
}

function getProof(chunks, index) {
    let level = chunks.map(c => new Uint8Array(sha256.array(c)));
    let proof = [];
    let myIdx = index;
    
    while (level.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = (i + 1 < level.length) ? level[i + 1] : left;
            if (i === myIdx || i + 1 === myIdx) {
                const isLeft = (myIdx % 2 === 1); 
                const sibling = isLeft ? left : right;
                proof.push({ hash: sibling, isLeft: isLeft });
                myIdx = Math.floor(myIdx / 2);
            }
            nextLevel.push(hashPair(left, right));
        }
        level = nextLevel;
    }
    return proof;
}

describe('Inscription V4 Lifecycle', () => {
    const contract = "inscription-v4";

    it('Lifecycle: begin -> add -> seal', () => {
        const chunk1 = new Uint8Array(65536).fill(1);
        const chunk2 = new Uint8Array(100).fill(2);
        const chunks = [chunk1, chunk2];
        const root = getMerkleRoot(chunks);
        const context = root; 
        const totalSize = chunk1.length + chunk2.length;

        // 1. Begin
        const beginRes = simnet.callPublicFn(contract, "begin-inscription", [
            bufferCV(root),
            stringAsciiCV("text/plain"),
            uintCV(totalSize),
            uintCV(chunks.length),
            bufferCV(context)
        ], wallet1);
        
        expect(beginRes.result.type).toBe(ClarityType.ResponseOk);
        expect(beginRes.result.value).toEqual(boolCV(true));

        // 2. Add Chunk 0
        const proof0 = getProof(chunks, 0);
        const proofList0 = proof0.map(p => tupleCV({ hash: bufferCV(p.hash), "is-left": boolCV(p.isLeft) }));
        
        const add0Res = simnet.callPublicFn(contract, "add-chunk", [
            bufferCV(root),
            uintCV(0),
            bufferCV(chunk1),
            listCV(proofList0)
        ], wallet1);

        expect(add0Res.result.type).toBe(ClarityType.ResponseOk);
        expect(add0Res.result.value).toEqual(boolCV(true));

        // 3. Add Chunk 1
        const proof1 = getProof(chunks, 1);
        const proofList1 = proof1.map(p => tupleCV({ hash: bufferCV(p.hash), "is-left": boolCV(p.isLeft) }));
        
        const add1Res = simnet.callPublicFn(contract, "add-chunk", [
            bufferCV(root),
            uintCV(1),
            bufferCV(chunk2),
            listCV(proofList1)
        ], wallet1);

        expect(add1Res.result.type).toBe(ClarityType.ResponseOk);
        expect(add1Res.result.value).toEqual(boolCV(true));

        // 4. Seal
        const sealRes = simnet.callPublicFn(contract, "seal-inscription", [
            bufferCV(root)
        ], wallet1);
        
        expect(sealRes.result.type).toBe(ClarityType.ResponseOk);
        expect(sealRes.result.value).toEqual(uintCV(0));
    });
});
