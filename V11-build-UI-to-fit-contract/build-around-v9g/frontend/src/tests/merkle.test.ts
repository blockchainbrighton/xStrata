import { describe, it, expect } from 'vitest';
import { createMerkleTree, getMerkleRoot, getMerkleProof, verifyMerkleProof } from '../domain/merkle';
import { sha256 } from '@noble/hashes/sha256';

// Mock data
const chunk1 = new Uint8Array([1, 2, 3]);
const chunk2 = new Uint8Array([4, 5, 6]);
const chunk3 = new Uint8Array([7, 8, 9]);
const chunk4 = new Uint8Array([10, 11, 12]);

describe('Merkle Tree Logic', () => {
  it('should generate a valid root for a single leaf', () => {
    const leaves = [chunk1];
    const tree = createMerkleTree(leaves);
    const root = getMerkleRoot(tree);
    
    // For single leaf, root is hash(leaf) ? Or does it need to be balanced?
    // Contract verify-proof folds over the proof. If proof is empty, root == leaf.
    // But usually we want at least one step if it's a tree?
    // The contract allows arbitrary proof length (up to 32).
    // If only 1 chunk, index 0. proof is empty list.
    // fold returns initial value (leaf) if list is empty.
    // So Root = sha256(chunk).
    
    expect(root).toEqual(sha256(chunk1));
  });

  it('should generate a valid root and proof for 2 leaves', () => {
    const leaves = [chunk1, chunk2];
    const tree = createMerkleTree(leaves);
    const root = getMerkleRoot(tree);
    
    // Root should be hash(hash(chunk1) + hash(chunk2))
    const h1 = sha256(chunk1);
    const h2 = sha256(chunk2);
    // sha256 of concatenated buffers
    const expectedRoot = sha256(Buffer.concat([h1, h2])); 
    
    expect(Buffer.from(root).toString('hex')).toEqual(Buffer.from(expectedRoot).toString('hex'));

    // Proof for chunk 1 (index 0)
    // Should be [ { hash: h2, isLeft: false } ]
    // Because to get root from h1, we need h2 on the right.
    // (hash-pair h1 h2) -> root.
    // Contract: (if (get is-left step) (hash-pair step-hash acc) (hash-pair acc step-hash))
    // acc is h1. step-hash is h2. We want (hash-pair acc h2). 
    // So is-left should be FALSE. 
    
    const proof0 = getMerkleProof(tree, 0);
    expect(proof0).toHaveLength(1);
    expect(Buffer.from(proof0[0].hash).toString('hex')).toEqual(Buffer.from(h2).toString('hex'));
    expect(proof0[0].isLeft).toBe(false);

    const isValid = verifyMerkleProof(root, sha256(chunk1), proof0);
    expect(isValid).toBe(true);
  });

  it('should generate valid proofs for 4 leaves (balanced tree)', () => {
    const leaves = [chunk1, chunk2, chunk3, chunk4];
    const tree = createMerkleTree(leaves);
    const root = getMerkleRoot(tree);
    
    // h1, h2, h3, h4
    // p1 = hash(h1 + h2)
    // p2 = hash(h3 + h4)
    // root = hash(p1 + p2)
    
    // Proof for chunk 3 (index 2) -> h3
    // Path: 
    // 1. Combine with h4 (right neighbor). Acc becomes p2. (step: {hash: h4, isLeft: false})
    // 2. Combine with p1 (left neighbor). Acc becomes root. (step: {hash: p1, isLeft: true})
    
    const proof2 = getMerkleProof(tree, 2);
    expect(proof2).toHaveLength(2);
    
    // Verify locally
    const isValid = verifyMerkleProof(root, sha256(chunk3), proof2);
    expect(isValid).toBe(true);
  });
  
  it('should handle odd number of leaves (3 leaves)', () => {
     // Standard Merkle tree usually duplicates last leaf or promotes it.
     // We need to decide on a strategy. 
     // Contract doesn't enforce strategy, only verification.
     // Common strategy: duplicate last hash to make even pair.
     // Or promote node.
     // Let's implement duplicate last node strategy as it's simple and standard (e.g. Bitcoin).
     
     const leaves = [chunk1, chunk2, chunk3];
     const tree = createMerkleTree(leaves);
     const root = getMerkleRoot(tree);
     
     // Tree:
     // h1, h2, h3, h3 (duplicated)
     // p1 = h(h1+h2)
     // p2 = h(h3+h3)
     // root = h(p1+p2)
     
     const proof2 = getMerkleProof(tree, 2); // for chunk3
     // 1. Neighbor is h3 (duplicated). isLeft: false.
     // 2. Neighbor is p1. isLeft: true.
     
     const isValid = verifyMerkleProof(root, sha256(chunk3), proof2);
     expect(isValid).toBe(true);
  });
});
