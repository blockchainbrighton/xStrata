import { sha256 } from 'js-sha256';

export function bufToHex(buffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hashChunk(chunkBytes) { return sha256.array(chunkBytes); }

function hashLeaf(index, chunkHash) {
  const buffer = new ArrayBuffer(4 + 32);
  const view = new DataView(buffer);
  view.setUint32(0, index, false);
  const byteView = new Uint8Array(buffer);
  byteView.set(chunkHash, 4);
  return sha256.array(byteView);
}

export function computeMerkleRoot(chunks) {
  let level = chunks.map((chunk, index) => hashLeaf(index, hashChunk(chunk)));
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = (i + 1 < level.length) ? level[i + 1] : left;
      const parentPreimage = new Uint8Array(left.length + right.length);
      parentPreimage.set(left, 0);
      parentPreimage.set(right, left.length);
      nextLevel.push(sha256.array(parentPreimage));
    }
    level = nextLevel;
  }
  return level[0];
}

export function chunkFile(fileBuffer) {
  const CHUNK_SIZE = 8192;
  const chunks = [];
  for (let i = 0; i < fileBuffer.byteLength; i += CHUNK_SIZE) {
    chunks.push(new Uint8Array(fileBuffer.slice(i, i + CHUNK_SIZE)));
  }
  return chunks;
}
