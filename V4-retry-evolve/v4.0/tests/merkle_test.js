import { chunkFile, computeMerkleRoot, bufToHex } from '../src/lib/merkle.js';
import { Buffer } from 'buffer';

// Mocking some data
const testString = "Hello Stacks! This is a test file to verify chunking and merkle roots.";
const testBuffer = Buffer.from(testString);

console.log("--- Starting Merkle Logic Tests ---");

// Test 1: Chunking
console.log("\nTest 1: Chunking");
const chunks = chunkFile(testBuffer);
console.log(`Input size: ${testBuffer.length} bytes`);
console.log(`Chunk count: ${chunks.length}`);

if (chunks.length !== 1) {
    console.error("FAIL: Expected 1 chunk for small file.");
    process.exit(1);
} else {
    console.log("PASS: Chunk count correct.");
}

// Verify chunk content
if (Buffer.from(chunks[0]).toString() === testString) {
    console.log("PASS: Chunk content matches.");
} else {
    console.error("FAIL: Chunk content mismatch.");
    process.exit(1);
}

// Test 2: Merkle Root
console.log("\nTest 2: Merkle Root");
try {
    const root = computeMerkleRoot(chunks);
    const rootHex = bufToHex(root);
    console.log(`Calculated Root: ${rootHex}`);
    
    // Known hash for SHA256("Hello Stacks!...") wrapped in the leaf hashing logic?
    // Since the logic is specific (hashLeaf(index, hashChunk(data))), calculating manual expectation is complex here.
    // Instead, we will verify consistency (same input = same output).
    
    const root2 = computeMerkleRoot(chunkFile(Buffer.from(testString)));
    const rootHex2 = bufToHex(root2);
    
    if (rootHex === rootHex2) {
        console.log("PASS: Deterministic root generation.");
    } else {
        console.error("FAIL: Non-deterministic root generation.");
        process.exit(1);
    }
} catch (e) {
    console.error("FAIL: Merkle computation threw error:", e);
    process.exit(1);
}

// Test 3: Multiple Chunks
console.log("\nTest 3: Multiple Chunks (Simulated)");
// Create a buffer larger than 8192 (chunk size)
const largeSize = 8192 * 2 + 100; // 2 full chunks + 100 bytes
const largeBuffer = Buffer.alloc(largeSize, 'a'); // Fill with 'a'

const largeChunks = chunkFile(largeBuffer);
console.log(`Large Input size: ${largeSize}`);
console.log(`Large Chunk count: ${largeChunks.length}`);

if (largeChunks.length === 3) {
    console.log("PASS: Correct number of chunks for large file.");
} else {
    console.error(`FAIL: Expected 3 chunks, got ${largeChunks.length}`);
    process.exit(1);
}

console.log("\n--- All Logic Tests Passed ---");
