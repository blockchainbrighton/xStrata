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
  "CONTRACT_SOURCE_BATCHXR_V9_2_3"
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
  }
];

module.exports = { tests };
