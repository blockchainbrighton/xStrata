"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");
const contractsPath = path.join(repoRoot, "assets", "core", "contracts", "index.js");

const expected = [
  "CONTRACT_SOURCE",
  "CONTRACT_SOURCE_BATCH",
  "CONTRACT_SOURCE_BATCHX",
  "CONTRACT_SOURCE_BATCHXR",
  "CONTRACT_SOURCE_BATCHXR_V6",
  "CONTRACT_SOURCE_BATCHXR_V9",
  "CONTRACT_SOURCE_BATCHXR_V9_2",
  "CONTRACT_SOURCE_BATCHXR_V9_2_2",
  "CONTRACT_SOURCE_BATCHXR_V9_2_3",
  "CONTRACT_SOURCE_BATCHXR_V9_2_5",
  "CONTRACT_SOURCE_BATCHXR_V9_2_6",
  "CONTRACT_SOURCE_BATCHXR_V9_2_7",
  "CONTRACT_SOURCE_BATCHXR_V9_2_8",
  "CONTRACT_SOURCE_BATCHXR_V9_2_9",
  "CONTRACT_SOURCE_BATCHXR_V9_2_10",
  "CONTRACT_SOURCE_SVG_REGISTRY",
  "CONTRACT_SOURCE_SVG_REGISTRY_V2"
];

const tests = [
  {
    name: "embedded contract sources exist and are non-empty",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const re = /export const (\w+) = `([\s\S]*?)`/g;
      const found = new Map();
      let match;
      while ((match = re.exec(text)) !== null) {
        found.set(match[1], match[2]);
      }

      const missing = expected.filter((name) => !found.has(name));
      assert.strictEqual(
        missing.length,
        0,
        `Missing embedded contract sources: ${missing.join(", ")}`
      );

      for (const name of expected) {
        const body = found.get(name) || "";
        assert(
          body.length > 200,
          `${name} looks too small (${body.length} chars)`
        );
        assert(
          body.includes("(define-"),
          `${name} does not resemble a Clarity contract`
        );
      }
    }
  },
  {
    name: "v9.2.5 avoids self-royalty transfer",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const match = text.match(
        /CONTRACT_SOURCE_BATCHXR_V9_2_5\s*=\s*`([\s\S]*?)`/
      );
      assert(match, "Expected v9.2.5 contract source");
      const body = match[1] || "";
      assert(
        body.includes("(is-eq tx-sender (var-get royalty-recipient))"),
        "Expected v9.2.5 to guard self royalty transfer"
      );
    }
  },
  {
    name: "v9.2.6 avoids self-royalty transfer",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const match = text.match(
        /CONTRACT_SOURCE_BATCHXR_V9_2_6\s*=\s*`([\s\S]*?)`/
      );
      assert(match, "Expected v9.2.6 contract source");
      const body = match[1] || "";
      assert(
        body.includes("(is-eq tx-sender (var-get royalty-recipient))"),
        "Expected v9.2.6 to guard self royalty transfer"
      );
      assert(
        body.includes("(buff 16384)"),
        "Expected v9.2.6 to use 16 KB chunk buffers"
      );
      assert(
        body.includes("(list 20 (buff 16384))"),
        "Expected v9.2.6 to allow 20x 16 KB chunks per batch"
      );
    }
  },
  {
    name: "v9.2.7 supports 16 KB chunks with larger batches",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const match = text.match(
        /CONTRACT_SOURCE_BATCHXR_V9_2_7\s*=\s*`([\s\S]*?)`/
      );
      assert(match, "Expected v9.2.7 contract source");
      const body = match[1] || "";
      assert(
        body.includes("(is-eq tx-sender (var-get royalty-recipient))"),
        "Expected v9.2.7 to guard self royalty transfer"
      );
      assert(
        body.includes("(buff 16384)"),
        "Expected v9.2.7 to use 16 KB chunk buffers"
      );
      assert(
        body.includes("(list 50 (buff 16384))"),
        "Expected v9.2.7 to allow 50x 16 KB chunks per batch"
      );
    }
  },
  {
    name: "v9.2.8 uses begin + seal royalties with 50x 16 KB batches",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const match = text.match(
        /CONTRACT_SOURCE_BATCHXR_V9_2_8\s*=\s*`([\s\S]*?)`/
      );
      assert(match, "Expected v9.2.8 contract source");
      const body = match[1] || "";
      assert(
        body.includes("(define-constant ROYALTY-BEGIN u100000)"),
        "Expected v9.2.8 to define begin royalty"
      );
      assert(
        body.includes("(define-constant ROYALTY-SEAL-BASE u100000)"),
        "Expected v9.2.8 to define seal base royalty"
      );
      assert(
        body.includes("(define-constant ROYALTY-SEAL-PER-CHUNK u10000)"),
        "Expected v9.2.8 to define per-chunk seal royalty"
      );
      assert(
        body.includes("(list 50 (buff 16384))"),
        "Expected v9.2.8 to allow 50x 16 KB chunks per batch"
      );
    }
  },
  {
    name: "v9.2.9 embeds SVG token uri",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const match = text.match(
        /CONTRACT_SOURCE_BATCHXR_V9_2_9\s*=\s*`([\s\S]*?)`/
      );
      assert(match, "Expected v9.2.9 contract source");
      const body = match[1] || "";
      assert(
        body.includes("SVG-BODY") && body.includes("SVG-PREFIX"),
        "Expected v9.2.9 to define embedded SVG constants"
      );
      assert(
        body.includes("(get-token-uri"),
        "Expected v9.2.9 to define get-token-uri"
      );
    }
  },
  {
    name: "v9.2.10 stores token uris per id",
    run() {
      const text = fs.readFileSync(contractsPath, "utf8");
      const match = text.match(
        /CONTRACT_SOURCE_BATCHXR_V9_2_10\s*=\s*`([\s\S]*?)`/
      );
      assert(match, "Expected v9.2.10 contract source");
      const body = match[1] || "";
      assert(
        body.includes("(define-map TokenURIs") &&
          body.includes("(get-token-uri"),
        "Expected v9.2.10 to define TokenURIs map and get-token-uri"
      );
    }
  }
];

module.exports = { tests };
