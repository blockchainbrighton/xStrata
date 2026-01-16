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
    name: "sequential resume uses current-index and skips scanMissingChunks",
    run() {
      const core = read("assets/core/index.js");

      assert(
        core.includes("Resuming sequential upload from chunk"),
        "Expected sequential resume guidance in mint flow"
      );
      assert(
        core.includes("return { currentIndex, state }"),
        "Expected upload-state to return currentIndex for sequential resume"
      );

      const seqIndex = core.indexOf("Resuming sequential upload from chunk");
      const seqWindow = core.slice(
        Math.max(0, seqIndex - 250),
        seqIndex + 250
      );
      assert(
        seqWindow.includes("currentChunks.length-startIndex"),
        "Expected sequential resume to build contiguous indices from startIndex"
      );

      const scanIndex = core.indexOf(
        "scanMissingChunks(currentRoot,currentChunks.length)"
      );
      const scanWindow = core.slice(
        Math.max(0, scanIndex - 250),
        scanIndex + 250
      );
      const seqModes = [
        'mode === "batchxrv9-2"',
        'mode === "batchxrv9-2-2"',
        'mode === "batchxrv9-2-3"',
        'mode === "batchxrv9-2-5"',
        'mode === "batchxrv9-2-6"',
        'mode === "batchxrv9-2-7"',
        'mode === "batchxrv9-2-8"',
        'mode === "batchxrv9-2-9"'
      ];
      seqModes.forEach((mode) => {
        assert(
          !scanWindow.includes(mode),
          "Sequential modes should not invoke scanMissingChunks"
        );
      });
    }
  }
];

module.exports = { tests };
