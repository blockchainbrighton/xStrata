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
    name: "v9.2+ uses sequential hashing; v9 does not",
    run() {
      const core = read("assets/core/index.js");
      const seqModes = [
        "batchxrv9-2",
        "batchxrv9-2-2",
        "batchxrv9-2-3",
        "batchxrv9-2-5",
        "batchxrv9-2-6",
        "batchxrv9-2-7"
      ];
      const seqCall = "computeSequentialHash(currentChunks)";
      const seqIndex = core.indexOf(seqCall);

      assert(seqIndex !== -1, "Expected sequential hash invocation");

      const seqWindow = core.slice(Math.max(0, seqIndex - 500), seqIndex);
      seqModes.forEach((mode) => {
        assert(
          seqWindow.includes(mode),
          `Expected ${mode} to gate computeSequentialHash`
        );
      });

      assert(
        !seqWindow.includes('mode === "batchxrv9"'),
        "v9 should not use computeSequentialHash"
      );
    }
  },
  {
    name: "get-upload-state is only used for v9.2+",
    run() {
      const core = read("assets/core/index.js");
      const seqModes = [
        "batchxrv9-2",
        "batchxrv9-2-2",
        "batchxrv9-2-3",
        "batchxrv9-2-5",
        "batchxrv9-2-6",
        "batchxrv9-2-7"
      ];
      const uploadCall = 'functionName: "get-upload-state"';
      const uploadIndex = core.indexOf(uploadCall);

      assert(uploadIndex !== -1, "Expected get-upload-state call");

      const uploadWindow = core.slice(
        Math.max(0, uploadIndex - 500),
        uploadIndex
      );
      seqModes.forEach((mode) => {
        assert(
          uploadWindow.includes(mode),
          `Expected get-upload-state gating for ${mode}`
        );
      });
      assert(
        !uploadWindow.includes('mode === "batchxrv9"'),
        "v9 should not use get-upload-state"
      );
    }
  },
  {
    name: "UI exposes Merkle vs Sequential guidance",
    run() {
      const html = read("index.html");
      assert(
        html.includes("Merkle") && html.includes("Sequential"),
        "Expected contract selector guidance to mention Merkle and Sequential"
      );
      assert(
        html.includes("v9.2.2") &&
        html.includes("v9.2.3") &&
        html.includes("v9.2.5") &&
        html.includes("v9.2.6") &&
        html.includes("v9.2.7"),
        "Expected UI to mention v9.2.2, v9.2.3, v9.2.5, v9.2.6, and v9.2.7"
      );
      assert(
        html.includes("contract-mode-help"),
        "Expected contract-mode-help element in index.html"
      );
    }
  }
];

module.exports = { tests };
