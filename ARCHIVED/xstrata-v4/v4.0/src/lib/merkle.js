import { sha256 } from 'js-sha256';

export function bufToHex(buffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hashPair(a, b) {
  const concat = new Uint8Array(a.length + b.length);
  concat.set(a);
  concat.set(b, a.length);
  return sha256.array(concat);
}

export function computeMerkleRoot(chunks) {
  // Contract expects tree of sha256(chunk_data)
  let level = chunks.map(chunk => sha256.array(chunk));
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

export function getProof(chunks, index) {
  let level = chunks.map(chunk => sha256.array(chunk));
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
        proof.push({ hash: new Uint8Array(sibling), isLeft: isLeft });
        myIdx = Math.floor(myIdx / 2);
      }
      nextLevel.push(hashPair(left, right));
    }
    level = nextLevel;
  }
  return proof;
}

export function chunkFile(fileBuffer) {
  const CHUNK_SIZE = 65536; // Updated to 64KB per contract MAX-CHUNK-SIZE
  const chunks = [];
  for (let i = 0; i < fileBuffer.byteLength; i += CHUNK_SIZE) {
    chunks.push(new Uint8Array(fileBuffer.slice(i, i + CHUNK_SIZE)));
  }
  return chunks;
}
