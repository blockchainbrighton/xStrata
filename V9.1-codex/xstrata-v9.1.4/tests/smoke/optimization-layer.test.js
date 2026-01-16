"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");
const filePath = path.join(repoRoot, "assets", "api", "optimization.js");

const tests = [
  {
    name: "optimization layer overrides fetch and proxies Hiro API",
    run() {
      const text = fs.readFileSync(filePath, "utf8");
      assert(
        text.includes("const PROXY_BASE"),
        "PROXY_BASE constant is missing"
      );
      assert(
        /window\.fetch\s*=\s*async function/.test(text),
        "window.fetch override not found"
      );
      const hasHiroMatch = text.includes("hiroMatch");
      const hasHiroRegex = /hiro\\\.so/.test(text) || text.includes("hiro\\.so");
      assert(
        hasHiroMatch && hasHiroRegex,
        "Hiro API rewrite logic not found"
      );
    }
  }
];

module.exports = { tests };
