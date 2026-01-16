"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

const tests = [
  {
    name: "index.html loads assets/main.js as a module",
    run() {
      const html = read("index.html");
      assert(
        html.includes('type="module"') && html.includes('/assets/main.js'),
        "index.html should load /assets/main.js as a module"
      );
    }
  },
  {
    name: "main.js initializes optimization and globals",
    run() {
      const main = read("assets/main.js");
      assert(
        main.includes("initializeOptimizationLayer"),
        "assets/main.js should call initializeOptimizationLayer"
      );
      assert(
        main.includes("initializeGlobals"),
        "assets/main.js should call initializeGlobals"
      );
      assert(
        fs.existsSync(path.join(repoRoot, "assets", "core", "index.js")),
        "assets/core/index.js should exist"
      );
    }
  }
];

module.exports = { tests };
