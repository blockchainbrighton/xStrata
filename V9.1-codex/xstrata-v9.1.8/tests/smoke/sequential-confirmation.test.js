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
    name: "sequential modes wait for upload confirmation before proceeding",
    run() {
      const core = read("assets/core/index.js");

      assert(
        core.includes("forceSequentialWait=mode"),
        "Expected sequential wait guard in upload flow"
      );
      assert(
        core.includes("isSafeModeEnabled()||forceSequentialWait"),
        "Expected sequential modes to wait for tx confirmation"
      );
    }
  }
];

module.exports = { tests };
