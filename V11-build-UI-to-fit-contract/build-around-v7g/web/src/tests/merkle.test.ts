import { describe, it, expect } from 'vitest';
import { MerkleTree } from '../domain/merkle';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

describe('MerkleTree', () => {
  it('should generate correct root for 2 leaves', () => {
    const data1 = new Uint8Array([1]);
    const data2 = new Uint8Array([2]);
    const hash1 = sha256(data1);
    const hash2 = sha256(data2);
    
    const tree = new MerkleTree([hash1, hash2]);
    const root = tree.getRoot();
    
    const expectedRoot = sha256(new Uint8Array([...hash1, ...hash2]));
    expect(bytesToHex(root)).toBe(bytesToHex(expectedRoot));
  });

  it('should generate correct proofs', () => {
    const leaves = [1, 2, 3, 4].map(n => sha256(new Uint8Array([n])));
    const tree = new MerkleTree(leaves);
    
    // Proof for Leaf 0 (H1) -> Needs H2 (Right, is-left: false), then N2 (Right, is-left: false)
    const proof0 = tree.getProof(0);
    expect(proof0).toHaveLength(2);
    expect(proof0[0].isLeft).toBe(false); // Sibling is H2 (Right)
    expect(bytesToHex(proof0[0].hash)).toBe(bytesToHex(leaves[1]));
    
    // Proof for Leaf 1 (H2) -> Needs H1 (Left, is-left: true), then N2 (Right, is-left: false)
    const proof1 = tree.getProof(1);
    expect(proof1).toHaveLength(2);
    expect(proof1[0].isLeft).toBe(true); // Sibling is H1 (Left)
    expect(bytesToHex(proof1[0].hash)).toBe(bytesToHex(leaves[0]));
  });
});
