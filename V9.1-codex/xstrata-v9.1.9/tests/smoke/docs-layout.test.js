"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");

const requiredDocs = [
  "docs/README.md",
  "docs/maps/core-index.md",
  "docs/maps/index-map.md",
  "docs/maps/REPO_MAP.md",
  "docs/maps/CONTRACTS_MAP.md",
  "docs/reports/ORIENTATION_REPORT.md",
  "docs/context/GEMINI.md",
  "docs/process/INSCRIPTION_PROCESS.md",
  "docs/notes/TODO.md"
];

const tests = [
  {
    name: "docs layout includes required files",
    run() {
      const missing = requiredDocs.filter(
        (doc) => !fs.existsSync(path.join(repoRoot, doc))
      );
      assert.strictEqual(
        missing.length,
        0,
        `Missing docs: ${missing.join(", ")}`
      );
    }
  }
];

module.exports = { tests };
