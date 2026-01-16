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
    name: "abort logging includes tx_result repr",
    run() {
      const core = read("assets/core/index.js");
      assert(
        core.includes("txResultRepr:(re.tx_result&&re.tx_result.repr)||null"),
        "Expected poll abort logs to include tx_result repr"
      );
      assert(
        core.includes("Transaction failed: ${de}${re.tx_result&&re.tx_result.repr?"),
        "Expected abort error message to include tx_result repr"
      );
    }
  }
];

module.exports = { tests };
