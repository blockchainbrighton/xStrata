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
    name: "journey log controls exist in UI",
    run() {
      const html = read("index.html");
      const required = [
        "journey-log-controls",
        "journey-log-copy",
        "journey-log-clear",
        "data-log-filter=\"chain\"",
        "data-log-filter=\"auth\"",
        "data-log-filter=\"wallet\"",
        "data-log-filter=\"error\"",
        "data-log-filter=\"viewer\"",
        "data-log-filter=\"app\""
      ];

      required.forEach((needle) => {
        assert(
          html.includes(needle),
          `Expected journey log control ${needle}`
        );
      });
    }
  }
];

module.exports = { tests };
