import { sha256 } from '@noble/hashes/sha256';

export type MerkleStep = {
  hash: Uint8Array;
  isLeft: boolean;
};

// Tree is represented as levels of hashes. Index 0 is leaves. Last index is root.
export type MerkleTree = Uint8Array[][];

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

export function createMerkleTree(dataChunks: Uint8Array[]): MerkleTree {
  if (dataChunks.length === 0) return [[new Uint8Array(32)]]; // Empty tree edge case? Or throw.

  // 1. Hash all leaves
  let currentLevel = dataChunks.map(chunk => sha256(chunk));
  const levels: MerkleTree = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel: Uint8Array[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // Duplicate last if odd
      const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
      
      const combined = concatBytes(left, right);
      nextLevel.push(sha256(combined));
    }
    
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return levels;
}

export function getMerkleRoot(tree: MerkleTree): Uint8Array {
  if (tree.length === 0 || tree[tree.length - 1].length === 0) {
    return new Uint8Array(32);
  }
  return tree[tree.length - 1][0];
}

export function getMerkleProof(tree: MerkleTree, leafIndex: number): MerkleStep[] {
  const proof: MerkleStep[] = [];
  let index = leafIndex;

  // Iterate up to the second to last level (root doesn't have siblings)
  for (let level = 0; level < tree.length - 1; level++) {
    const currentLevel = tree[level];
    
    // Determine if we are left or right child in the pair
    const isLeftChild = index % 2 === 0;
    
    // Find sibling index
    // If we are left (0), sibling is 1. 
    // If we are right (1), sibling is 0.
    // If we are last element and odd, sibling is self (duplicated).
    
    let siblingIndex = isLeftChild ? index + 1 : index - 1;
    
    if (siblingIndex >= currentLevel.length) {
        // This case happens if we are the last element in an odd-length level.
        // We are duplicated, so our sibling is ourselves.
        siblingIndex = index;
    }

    const siblingHash = currentLevel[siblingIndex];
    
    // Contract Logic:
    // (if (get is-left step) (hash-pair step-hash acc) (hash-pair acc step-hash))
    // We want to reconstruct the parent.
    // If we are Left Child: Parent = Hash(Us + Sibling). 
    // Contract says: If step.isLeft is TRUE, then Hash(step.hash + acc).
    // Here acc is Us. So Hash(Sibling + Us). This would be WRONG.
    // Wait.
    // Let's re-read contract.
    // (if (get is-left step) (hash-pair (get hash step) acc) (hash-pair acc (get hash step)))
    // Acc is the current calculated hash (starts at leaf).
    // If step.isLeft is TRUE: hash-pair(step.hash, acc) -> Hash(Sibling + Us).
    // This implies the SIBLING is on the LEFT.
    
    // So:
    // If We are Right Child (index is odd): Sibling is Left. We need Hash(Sibling + Us).
    // So we need step.isLeft = TRUE.
    
    // If We are Left Child (index is even): Sibling is Right. We need Hash(Us + Sibling).
    // So we need step.isLeft = FALSE (else branch: hash-pair acc step.hash).
    
    const isSiblingOnLeft = !isLeftChild;
    
    proof.push({
      hash: siblingHash,
      isLeft: isSiblingOnLeft
    });

    // Move to next level index
    index = Math.floor(index / 2);
  }

  return proof;
}

export function verifyMerkleProof(root: Uint8Array, leaf: Uint8Array, proof: MerkleStep[]): boolean {
  let acc = leaf;
  
  for (const step of proof) {
    if (step.isLeft) {
      // Sibling is on left: Hash(Sibling + Acc)
      acc = sha256(concatBytes(step.hash, acc));
    } else {
      // Sibling is on right: Hash(Acc + Sibling)
      acc = sha256(concatBytes(acc, step.hash));
    }
  }
  
  // Compare byte by byte
  if (acc.length !== root.length) return false;
  for (let i = 0; i < acc.length; i++) {
    if (acc[i] !== root[i]) return false;
  }
  return true;
}
