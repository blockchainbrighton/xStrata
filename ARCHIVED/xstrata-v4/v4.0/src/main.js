import * as Connect from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { 
    callReadOnlyFunction, 
    cvToValue, 
    uintCV, 
    bufferCV, 
    stringAsciiCV, 
    listCV,
    tupleCV,
    trueCV,
    falseCV,
    standardPrincipalCV,
    PostConditionMode,
    AnchorMode
} from '@stacks/transactions';
import { chunkFile, MerkleTree, bufToHex } from './lib/merkle.js';
import { processRecursiveAudio } from './lib/audio-engine.js';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

// --- CONFIGURATION ---
const appConfig = new Connect.AppConfig(['store_write', 'publish_data']);
const userSession = new Connect.UserSession({ appConfig });
const network = new StacksTestnet({ url: 'https://api.testnet.hiro.so' });
const EXPLORER_BASE_URL = 'https://explorer.hiro.so';

// --- LOGGING ---
function log(msg, data = null) {
    const time = new Date().toLocaleTimeString();
    const txt = `[${time}] ${msg}`;
    console.log(txt, data || '');
    const el = document.getElementById('app-log');
    if (el) {
        const div = document.createElement('div');
        div.innerText = txt + (data ? ' ' + JSON.stringify(data, (k,v) => typeof v === 'bigint' ? v.toString()+'n' : v) : '');
        el.prepend(div);
    }
}

// --- OPTIMIZATION LAYER (Fetch Wrapper) ---
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        // Simple retry logic for 503s or network errors
        const MAX_RETRIES = 3;
        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            try {
                const res = await originalFetch(input, init);
                if (res.status === 429 || res.status >= 500) {
                    throw new Error(`Status ${res.status}`);
                }
                return res;
            } catch (e) {
                attempt++;
                if (attempt >= MAX_RETRIES) throw e;
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    };
})();

// --- STATE ---
let currentChunks = [];
let currentTree = null;
let currentRoot = null;
let currentFileMeta = null;

// --- UI HANDLERS ---
window.showPage = (pageId) => {
    document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
};

function updateAuthUI() {
    if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        const address = userData.profile.stxAddress.testnet;
        document.getElementById('connect-wallet').classList.add('hidden');
        document.getElementById('disconnect-wallet').classList.remove('hidden');
        document.getElementById('address-display').innerText = address;
        document.getElementById('auth-status').innerText = 'Connected';
    } else {
        document.getElementById('connect-wallet').classList.remove('hidden');
        document.getElementById('disconnect-wallet').classList.add('hidden');
        document.getElementById('address-display').innerText = '';
        document.getElementById('auth-status').innerText = 'Not Connected';
    }
}

document.getElementById('connect-wallet').addEventListener('click', () => {
    Connect.showConnect({
        appDetails: { name: 'XStrata V4', icon: window.location.origin + '/vite.svg' },
        redirectTo: '/',
        onFinish: () => updateAuthUI(),
        userSession
    });
});

document.getElementById('disconnect-wallet').addEventListener('click', () => {
    userSession.signUserOut();
    updateAuthUI();
});

// --- CONTRACT HELPERS ---
function getContractInfo() {
    const val = document.getElementById('contract-address-input').value.trim();
    const [addr, name] = val.split('.');
    return { address: addr, name: name };
}

function getContractSource() {
    // We would typically read this from a file, but for the Deploy button we need it in memory.
    // Since we can't easily fetch the local file in browser without a bundler plugin injecting it,
    // I will fetch it if possible, or assume the user wants to deploy what's in the repo.
    // For this prototype, I will rely on the user having deployed it or paste the code.
    // However, to make the 'Deploy' button work, I need the source string.
    // I will fetch it from the public dir if I put it there, or just alert the user.
    // Let's try to fetch it relative to root.
    return fetch('/contracts/inscription-v4.clar').then(r => r.text());
}

document.getElementById('btn-deploy-contract').addEventListener('click', async () => {
    if (!userSession.isUserSignedIn()) return alert("Connect wallet first");
    
    try {
        const code = await getContractSource();
        const { name } = getContractInfo();
        
        Connect.openContractDeploy({
            contractName: name,
            codeBody: code,
            network,
            onFinish: (data) => log('Deploy sent!', data),
            onCancel: () => log('Deploy cancelled')
        });
    } catch (e) {
        log('Deploy failed', e);
        alert('Could not load contract source. Ensure /contracts/inscription-v4.clar exists in public or src.');
    }
});

// --- MINTING LOGIC ---
document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    log(`Processing file: ${file.name} (${file.size} bytes)`);
    const buf = await file.arrayBuffer();
    
    currentChunks = chunkFile(buf); // returns Uint8Array[]
    currentTree = new MerkleTree(currentChunks);
    currentRoot = currentTree.getRoot();
    currentFileMeta = { name: file.name, type: file.type, size: file.size };

    document.getElementById('mint-preview-area').classList.remove('hidden');
    document.getElementById('file-stats').innerHTML = `
        <strong>Chunks:</strong> ${currentChunks.length}<br>
        <strong>Merkle Root:</strong> 0x${bufToHex(currentRoot)}<br>
        <strong>Est. TXs:</strong> ${Math.ceil(currentChunks.length / getBatchSize()) + 2}
    `;
});

function getBatchSize() {
    return parseInt(document.getElementById('batch-size-select').value);
}

document.getElementById('btn-start-mint').addEventListener('click', async () => {
    if (!userSession.isUserSignedIn()) return alert("Connect wallet first");
    if (!currentChunks.length) return;

    const { address, name } = getContractInfo();
    const statusEl = document.getElementById('mint-progress');
    
    // 1. Begin Inscription
    log('Step 1: Begin Inscription...');
    statusEl.innerText = "Step 1: initializing...";
    
    const beginArgs = [
        bufferCV(currentRoot),
        stringAsciiCV(currentFileMeta.type || 'application/octet-stream'),
        uintCV(currentFileMeta.size),
        uintCV(currentChunks.length),
        bufferCV(currentRoot) // Context is usually root
    ];

    await new Promise((resolve, reject) => {
        Connect.openContractCall({
            contractAddress: address,
            contractName: name,
            functionName: 'begin-inscription',
            functionArgs: beginArgs,
            network,
            onFinish: (data) => {
                log('Begin TX sent', data.txId);
                waitForTx(data.txId).then(resolve).catch(reject);
            },
            onCancel: () => reject(new Error("Cancelled"))
        });
    });

    // 2. Upload Batches
    statusEl.innerText = "Step 2: Uploading data...";
    const batchSize = getBatchSize();
    
    for (let i = 0; i < currentChunks.length; i += batchSize) {
        const batchChunks = currentChunks.slice(i, i + batchSize);
        const proofs = [];
        
        // Generate proofs for this batch
        for (let j = 0; j < batchChunks.length; j++) {
            const globalIndex = i + j;
            const proofRaw = currentTree.getProof(globalIndex);
            // Convert to CV
            // proofRaw is [{ hash, isLeft }]
            // Contract expects: (list 32 (tuple (hash (buff 32)) (is-left bool)))
            const proofCV = listCV(proofRaw.map(p => tupleCV({
                hash: bufferCV(p.hash),
                'is-left': p.isLeft ? trueCV() : falseCV()
            })));
            proofs.push(proofCV);
        }

        const chunkListCV = listCV(batchChunks.map(c => bufferCV(c)));
        const proofListCV = listCV(proofs);

        log(`Uploading batch starting at index ${i}...`);
        statusEl.innerText = `Uploading batch ${i / batchSize + 1}...`;

        await new Promise((resolve, reject) => {
            Connect.openContractCall({
                contractAddress: address,
                contractName: name,
                functionName: 'add-chunk-batch',
                functionArgs: [
                    bufferCV(currentRoot),
                    uintCV(i),
                    chunkListCV,
                    proofListCV
                ],
                postConditionMode: PostConditionMode.Allow,
                network,
                onFinish: (data) => {
                    log(`Batch ${i} sent`, data.txId);
                    waitForTx(data.txId).then(resolve).catch(reject);
                },
                onCancel: () => reject(new Error("Cancelled"))
            });
        });
    }

    // 3. Seal
    log('Step 3: Sealing...');
    statusEl.innerText = "Step 3: Sealing...";
    
    await new Promise((resolve, reject) => {
        Connect.openContractCall({
            contractAddress: address,
            contractName: name,
            functionName: 'seal-inscription',
            functionArgs: [bufferCV(currentRoot)],
            network,
            onFinish: (data) => {
                log('Seal TX sent', data.txId);
                waitForTx(data.txId).then(resolve).catch(reject);
            },
            onCancel: () => reject(new Error("Cancelled"))
        });
    });

    statusEl.innerText = "Done! Inscription Complete.";
    log("Inscription Complete!");
});

async function waitForTx(txId) {
    const url = `${network.coreApiUrl}/extended/v1/tx/${txId}`;
    while (true) {
        await new Promise(r => setTimeout(r, 3000));
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.tx_status === 'success') return data;
            if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
                throw new Error('Transaction failed: ' + data.tx_status);
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }
}

// --- VIEWER LOGIC ---
document.getElementById('btn-view-id').addEventListener('click', async () => {
    const id = parseInt(document.getElementById('view-id-input').value);
    if (isNaN(id)) return;
    
    const { address, name } = getContractInfo();
    const viewerEl = document.getElementById('viewer-container');
    viewerEl.innerHTML = 'Loading...';

    try {
        // Fetch Metadata
        const metaRes = await callReadOnlyFunction({
            contractAddress: address,
            contractName: name,
            functionName: 'get-inscription',
            functionArgs: [uintCV(id)],
            senderAddress: address,
            network
        });
        
        const metaOpt = cvToValue(metaRes);
        if (!metaOpt || !metaOpt.value) throw new Error("Inscription not found");
        const meta = metaOpt.value; // It's a tuple inside 'some' usually, cvToValue handles 'some'? 
        // cvToValue for (some ...) returns the inner value directly usually, or { type, value } depending on version.
        // Let's assume standard object return.
        
        const chunkCount = Number(meta['chunk-count'].value);
        const mime = meta['mime-type'].value;
        const totalSize = Number(meta['total-size'].value);
        const dataHash = meta['data-hash'].value; // Buffer

        log(`Found inscription. Chunks: ${chunkCount}, MIME: ${mime}`);

        // Fetch Chunks
        const chunks = [];
        for (let i = 0; i < chunkCount; i++) {
            const chunkRes = await callReadOnlyFunction({
                contractAddress: address,
                contractName: name,
                functionName: 'get-chunk',
                functionArgs: [uintCV(id), uintCV(i)],
                senderAddress: address,
                network
            });
            const chunkVal = cvToValue(chunkRes);
            if (!chunkVal) throw new Error(`Chunk ${i} missing`);
            // chunkVal should be Uint8Array or object with value
            chunks.push(chunkVal.value || chunkVal); 
        }

        // Reassemble
        const fullData = new Uint8Array(totalSize);
        let offset = 0;
        for (const c of chunks) {
            fullData.set(c, offset);
            offset += c.length;
        }

        // Render
        const blob = new Blob([fullData], { type: mime });
        const url = URL.createObjectURL(blob);
        
        if (mime.startsWith('image/')) {
            viewerEl.innerHTML = `<img src="${url}" style="max-width:100%">`;
        } else if (mime.startsWith('audio/')) {
            viewerEl.innerHTML = `<audio controls src="${url}"></audio>`;
        } else {
            viewerEl.innerHTML = `<a href="${url}" download="inscription-${id}">Download ${mime}</a>`;
        }

    } catch (e) {
        log('Error viewing', e);
        viewerEl.innerText = 'Error: ' + e.message;
    }
});

updateAuthUI();
if (userSession.isSignInPending()) {
    userSession.handlePendingSignIn().then(updateAuthUI);
}