import { sha256 } from '@noble/hashes/sha2';

export type MerkleProofStep = {
  hash: Uint8Array;
  isLeft: boolean;
};

export class MerkleTree {
  leaves: Uint8Array[];
  levels: Uint8Array[][];

  constructor(leaves: Uint8Array[]) {
    this.leaves = leaves;
    this.levels = [leaves];
    this.build();
  }

  private build() {
    let currentLevel = this.leaves;
    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left; // Duplicate if odd
        const combined = new Uint8Array(left.length + right.length);
        combined.set(left);
        combined.set(right, left.length);
        nextLevel.push(sha256(combined));
      }
      this.levels.push(nextLevel);
      currentLevel = nextLevel;
    }
  }

  getRoot(): Uint8Array {
    if (this.levels.length === 0) return new Uint8Array(32);
    return this.levels[this.levels.length - 1][0];
  }

  getProof(index: number): MerkleProofStep[] {
    const proof: MerkleProofStep[] = [];
    let currentIndex = index;

    // Iterate up to the root (excluding the root level)
    for (let i = 0; i < this.levels.length - 1; i++) {
      const level = this.levels[i];
      const isRightChild = currentIndex % 2 === 1;
      
      if (isRightChild) {
        // Sibling is Left
        const siblingIndex = currentIndex - 1;
        proof.push({
          hash: level[siblingIndex],
          isLeft: true 
        });
      } else {
        // Sibling is Right
        const siblingIndex = currentIndex + 1;
        // If we are at the end and even, we might have duplicated. 
        // If sibling index exists in array, take it. Else take self (duplicated).
        const sibling = (siblingIndex < level.length) ? level[siblingIndex] : level[currentIndex];
        proof.push({
          hash: sibling,
          isLeft: false
        });
      }
      
      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }
}
