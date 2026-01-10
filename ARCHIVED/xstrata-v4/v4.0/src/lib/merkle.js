import { sha256 } from 'js-sha256';

export const CHUNK_SIZE = 65536; // 64KB

export function bufToHex(buffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Helper to hash a Uint8Array -> Uint8Array (32 bytes)
function sha256Raw(data) {
    return new Uint8Array(sha256.array(data));
}

// Leaf is just sha256(data)
export function hashLeaf(chunk) {
    return sha256Raw(chunk);
}

// Parent hash = sha256(left + right)
export function hashPair(left, right) {
    const concat = new Uint8Array(left.length + right.length);
    concat.set(left, 0);
    concat.set(right, left.length);
    return sha256Raw(concat);
}

export function chunkFile(fileBuffer) {
  const chunks = [];
  for (let i = 0; i < fileBuffer.byteLength; i += CHUNK_SIZE) {
    chunks.push(new Uint8Array(fileBuffer.slice(i, i + CHUNK_SIZE)));
  }
  return chunks;
}

export class MerkleTree {
    constructor(chunks) {
        this.leaves = chunks.map(c => hashLeaf(c));
        this.levels = [this.leaves];
        this.build();
    }

    build() {
        let currentLevel = this.leaves;
        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                // Duplicate last element if odd number of nodes
                const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
                nextLevel.push(hashPair(left, right));
            }
            this.levels.push(nextLevel);
            currentLevel = nextLevel;
        }
        this.root = currentLevel[0];
    }

    getRoot() {
        return this.root;
    }

    // Returns array of { hash: Uint8Array, isLeft: boolean }
    getProof(index) {
        let proof = [];
        let currentIndex = index;

        // Traverse up to the root (excluding the root itself)
        // levels[0] is leaves, levels[last] is root
        for (let i = 0; i < this.levels.length - 1; i++) {
            const level = this.levels[i];
            const isRightNode = currentIndex % 2 === 1;
            
            if (isRightNode) {
                // Sibling is to the left
                const siblingIndex = currentIndex - 1;
                const sibling = level[siblingIndex];
                proof.push({ hash: sibling, isLeft: true });
            } else {
                // Sibling is to the right
                // Be careful with odd number of nodes handling
                const siblingIndex = currentIndex + 1;
                // If this is the last node and it's even, duplication logic meant its "right" sibling was itself.
                // However, in the loop above: `const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;`
                // So if we are at the last even index, the sibling is the node itself?
                // Wait, if duplicating: 
                // [A, B, C] -> Pairs: (A,B), (C,C)
                // If I am C (index 2), my sibling is C (index 2? no, effectively index 3 but identical content).
                // Let's rely on the level array length.
                let sibling;
                if (siblingIndex < level.length) {
                    sibling = level[siblingIndex];
                } else {
                    sibling = level[currentIndex]; // Duplicate itself
                }
                proof.push({ hash: sibling, isLeft: false });
            }
            
            currentIndex = Math.floor(currentIndex / 2);
        }
        return proof;
    }
}

// Legacy wrapper for compatibility if needed, but app should use class
export function computeMerkleRoot(chunks) {
    const tree = new MerkleTree(chunks);
    return tree.getRoot();
}