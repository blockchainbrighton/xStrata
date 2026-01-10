#!/bin/bash

# Define the project name
PROJECT_NAME="stacks-inscription-proto"

echo "Creating project: $PROJECT_NAME"

# 1. Create directory structure
mkdir -p $PROJECT_NAME/contracts
mkdir -p $PROJECT_NAME/src/lib

# Navigate into project directory
cd $PROJECT_NAME

# 2. Write package.json
cat << 'EOF' > package.json
{
  "name": "stacks-inscription-proto",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@stacks/connect": "^7.3.0",
    "@stacks/network": "^6.0.0",
    "@stacks/transactions": "^6.0.0",
    "@stacks/common": "^6.0.0",
    "buffer": "^6.0.3",
    "js-sha256": "^0.9.0",
    "vite": "^4.4.0"
  },
  "devDependencies": {
    "vite-plugin-node-polyfills": "^0.9.0"
  }
}
EOF

# 3. Write vite.config.js
cat << 'EOF' > vite.config.js
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      protocolImports: true,
    }),
  ],
});
EOF

# 4. Write Clarity Contract
cat << 'EOF' > contracts/inscription-core.clar
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-SEALED (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-CHUNK (err u103))
(define-constant MAX-CHUNK-SIZE u8192)

(define-data-var next-id uint u0)

(define-map Inscriptions
    uint 
    {
        owner: principal,
        mime-type: (string-ascii 64),
        total-size: uint,
        chunk-count: uint,
        sealed: bool,
        merkle-root: (buff 32)
    }
)

(define-map Chunks { id: uint, index: uint } (buff 8192))

(define-public (begin-inscription (mime (string-ascii 64)) (total-size uint) (chunk-count uint))
    (let ((id (var-get next-id)))
        (map-insert Inscriptions id {
            owner: tx-sender,
            mime-type: mime,
            total-size: total-size,
            chunk-count: chunk-count,
            sealed: false,
            merkle-root: 0x00
        })
        (var-set next-id (+ id u1))
        (ok id)
    ))

(define-public (add-chunk (id uint) (index uint) (data (buff 8192)))
    (let ((meta (unwrap! (map-get? Inscriptions id) ERR-NOT-FOUND)))
        (asserts! (is-eq tx-sender (get owner meta)) ERR-NOT-AUTHORIZED)
        (asserts! (not (get sealed meta)) ERR-ALREADY-SEALED)
        (asserts! (< index (get chunk-count meta)) ERR-INVALID-CHUNK)
        (match (map-insert Chunks {id: id, index: index} data)
            success (ok true)
            error (err u105))))

(define-public (seal-inscription (id uint) (root (buff 32)))
    (let ((meta (unwrap! (map-get? Inscriptions id) ERR-NOT-FOUND)))
        (asserts! (is-eq tx-sender (get owner meta)) ERR-NOT-AUTHORIZED)
        (asserts! (not (get sealed meta)) ERR-ALREADY-SEALED)
        (map-set Inscriptions id (merge meta { sealed: true, merkle-root: root }))
        (ok true)))

(define-read-only (get-inscription (id uint)) (map-get? Inscriptions id))
(define-read-only (get-chunk (id uint) (index uint)) (map-get? Chunks {id: id, index: index}))
EOF

# 5. Write Merkle Library
cat << 'EOF' > src/lib/merkle.js
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
EOF

# 6. Write Audio Engine
cat << 'EOF' > src/lib/audio-engine.js
export async function processRecursiveAudio(clipBuffers) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decodedBuffers = await Promise.all(
    clipBuffers.map(async (buf) => {
      const tempBuf = buf.slice(0); 
      return await audioCtx.decodeAudioData(tempBuf);
    })
  );
  const totalLength = decodedBuffers.reduce((acc, b) => acc + b.length, 0);
  const outputBuffer = audioCtx.createBuffer(
    decodedBuffers[0].numberOfChannels,
    totalLength,
    decodedBuffers[0].sampleRate
  );
  let offset = 0;
  for (const buf of decodedBuffers) {
    for (const channel of [0, 1]) {
      if (channel < buf.numberOfChannels) {
        outputBuffer.getChannelData(channel).set(buf.getChannelData(channel), offset);
      }
    }
    offset += buf.length;
  }
  return { audioCtx, outputBuffer };
}
EOF

# 7. Write index.html
cat << 'EOF' > index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Stacks Inscription Proto</title>
    <style>
        body { font-family: monospace; max-width: 800px; margin: 0 auto; padding: 20px; background: #f0f0f0; }
        .card { background: white; padding: 20px; margin-bottom: 20px; border: 1px solid #ccc; }
        button { cursor: pointer; padding: 10px; background: #000; color: #fff; border: none; }
        .hidden { display: none; }
        input { width: 100%; margin: 10px 0; padding: 5px; }
    </style>
</head>
<body>
    <h1>Phase-1 Inscription Proto</h1>
    <div id="wallet-section" class="card">
        <button id="connect-wallet">Connect Wallet</button>
        <span id="address-display"></span>
    </div>
    <div class="card">
        <button onclick="showPage('mint')">Mint Mode</button>
        <button onclick="showPage('play')">Recursive Player</button>
    </div>
    <div id="page-mint" class="card hidden">
        <h2>Mint Inscription</h2>
        <input type="file" id="file-input">
        <div id="mint-steps"></div>
        <button id="btn-start-mint" class="hidden">Start Inscription</button>
    </div>
    <div id="page-play" class="card hidden">
        <h2>Recursive Audio Player</h2>
        <p>Enter Manifest ID:</p>
        <input type="number" id="manifest-id-input" placeholder="e.g. 5">
        <button id="btn-load-manifest">Load & Play Recursive Audio</button>
        <div id="player-log"></div>
    </div>
    <script type="module" src="/src/main.js"></script>
</body>
</html>
EOF

# 8. Write main.js logic
cat << 'EOF' > src/main.js
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { callReadOnlyFunction, cvToValue, uintCV, bufferCV, PostConditionMode } from '@stacks/transactions';
import { chunkFile, computeMerkleRoot, bufToHex } from './lib/merkle.js';
import { processRecursiveAudio } from './lib/audio-engine.js';
import { Buffer } from 'buffer';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });
const network = new StacksTestnet();
const CONTRACT_ADDR = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; 
const CONTRACT_NAME = 'inscription-core';
let currentFile = null;
let currentChunks = [];
let currentRoot = null;

window.showPage = (page) => {
  document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
  document.getElementById(`page-${page}`).classList.remove('hidden');
};

function log(msg) {
  const div = document.createElement('div');
  div.innerText = `> ${msg}`;
  document.getElementById('player-log').appendChild(div);
}

document.getElementById('connect-wallet').addEventListener('click', () => {
  showConnect({
    appDetails: { name: 'Stacks Proto', icon: window.location.origin + '/vite.svg' },
    redirectTo: '/',
    onFinish: () => { window.location.reload(); },
    userSession,
  });
});

if (userSession.isUserSignedIn()) {
  document.getElementById('address-display').innerText = `Connected: ${userSession.loadUserData().profile.stxAddress.testnet}`;
  document.getElementById('connect-wallet').classList.add('hidden');
}

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  currentChunks = chunkFile(buf);
  currentRoot = computeMerkleRoot(currentChunks);
  document.getElementById('mint-steps').innerHTML = `<p>Size: ${buf.byteLength} bytes | Chunks: ${currentChunks.length}</p><p>Root: 0x${bufToHex(currentRoot)}</p>`;
  document.getElementById('btn-start-mint').classList.remove('hidden');
});

document.getElementById('btn-start-mint').addEventListener('click', async () => {
    alert("Check console for flows. Assuming ID=0 for this session.");
    await openContractCall({
        contractAddress: CONTRACT_ADDR,
        contractName: CONTRACT_NAME,
        functionName: 'begin-inscription',
        functionArgs: [ { type: 13, data: "application/json" }, uintCV(currentChunks.length * 8192), uintCV(currentChunks.length) ],
        network,
        onFinish: (data) => { console.log("Begin TX:", data.txId); startChunkUploads(0); }
    });
});

async function openContractCall(opts) {
    const { openContractCall } = await import('@stacks/connect');
    return openContractCall({ ...opts, postConditionMode: PostConditionMode.Allow });
}

async function startChunkUploads(id) {
    for (let i = 0; i < currentChunks.length; i++) {
        await new Promise(resolve => {
            setTimeout(() => {
                openContractCall({
                    contractAddress: CONTRACT_ADDR,
                    contractName: CONTRACT_NAME,
                    functionName: 'add-chunk',
                    functionArgs: [ uintCV(id), uintCV(i), bufferCV(Buffer.from(currentChunks[i])) ],
                    network,
                    onFinish: (data) => { console.log(`Chunk ${i} TX:`, data.txId); resolve(); }
                });
            }, 1000); 
        });
    }
    openContractCall({
        contractAddress: CONTRACT_ADDR,
        contractName: CONTRACT_NAME,
        functionName: 'seal-inscription',
        functionArgs: [ uintCV(id), bufferCV(Buffer.from(currentRoot)) ],
        network,
        onFinish: (data) => console.log("Sealed!", data.txId)
    });
}

async function fetchInscriptionData(id) {
    const metaRes = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDR,
        contractName: CONTRACT_NAME,
        functionName: 'get-inscription',
        functionArgs: [uintCV(id)],
        senderAddress: CONTRACT_ADDR,
        network
    });
    const meta = cvToValue(metaRes);
    if (!meta) throw new Error("Inscription not found");
    const chunkCount = Number(meta.value['chunk-count'].value);
    const buffers = [];
    for (let i = 0; i < chunkCount; i++) {
        const chunkRes = await callReadOnlyFunction({
            contractAddress: CONTRACT_ADDR,
            contractName: CONTRACT_NAME,
            functionName: 'get-chunk',
            functionArgs: [uintCV(id), uintCV(i)],
            senderAddress: CONTRACT_ADDR,
            network
        });
        buffers.push(cvToValue(chunkRes).value);
    }
    const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
    const fullFile = new Uint8Array(totalLen);
    let offset = 0;
    buffers.forEach(b => { fullFile.set(b, offset); offset += b.length; });
    return fullFile;
}

document.getElementById('btn-load-manifest').addEventListener('click', async () => {
    const manifestId = parseInt(document.getElementById('manifest-id-input').value);
    try {
        log("Fetching Manifest...");
        const manifestBytes = await fetchInscriptionData(manifestId);
        const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
        log(`IDs: ${JSON.stringify(manifest)}`);
        const clipBuffers = [];
        for (const clipId of manifest) {
            log(`Fetching Clip ${clipId}...`);
            const clipData = await fetchInscriptionData(parseInt(clipId));
            clipBuffers.push(clipData.buffer);
        }
        log("Playing...");
        const { audioCtx, outputBuffer } = await processRecursiveAudio(clipBuffers);
        const source = audioCtx.createBufferSource();
        source.buffer = outputBuffer;
        source.connect(audioCtx.destination);
        source.start();
    } catch (e) { log(`Error: ${e.message}`); }
});
EOF

echo "------------------------------------------------"
echo "Project structure for '$PROJECT_NAME' created successfully."
echo "------------------------------------------------"
echo "To start development:"
echo "  cd $PROJECT_NAME"
echo "  npm install"
echo "  npm run dev"
echo "------------------------------------------------"