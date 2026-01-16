"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function extractIdsFromCore(coreText) {
  const ids = new Set();
  const getByIdRe = /getElementById\(\s*["']([^"']+)["']\s*\)/g;
  const queryRe = /querySelector(?:All)?\(\s*["']#([^"']+)["']\s*\)/g;

  let match;
  while ((match = getByIdRe.exec(coreText)) !== null) {
    ids.add(match[1]);
  }
  while ((match = queryRe.exec(coreText)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function extractIdsFromHtml(htmlText) {
  const ids = new Set();
  const idRe = /\bid\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = idRe.exec(htmlText)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function extractInlineHandlers(htmlText) {
  const handlers = new Set();
  const handlerRe = /\bon\w+\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = handlerRe.exec(htmlText)) !== null) {
    const raw = match[1].trim();
    const nameMatch = raw.match(/^([A-Za-z_$][\w$]*)\s*\(/);
    if (nameMatch) {
      handlers.add(nameMatch[1]);
    }
  }
  return handlers;
}

function isHandlerExposed(coreText, name) {
  const patterns = [
    new RegExp(`\\bwindow\\.${name}\\b`),
    new RegExp(`\\bfunction\\s+${name}\\b`),
    new RegExp(`\\b${name}\\s*=\\s*`)
  ];
  return patterns.some((re) => re.test(coreText));
}

const tests = [
  {
    name: "core-referenced DOM IDs exist in index.html",
    run() {
      const core = read("assets/core/index.js");
      const html = read("index.html");
      const coreIds = extractIdsFromCore(core);
      const htmlIds = extractIdsFromHtml(html);

      const allowlist = new Set(["seal-lookup-status", "seal-lookup-view"]);
      const missing = Array.from(coreIds).filter(
        (id) => !htmlIds.has(id) && !allowlist.has(id)
      );

      assert.strictEqual(
        missing.length,
        0,
        `Missing IDs in index.html: ${missing.join(", ")}`
      );
    }
  },
  {
    name: "inline handlers map to core-exposed functions",
    run() {
      const core = read("assets/core/index.js");
      const html = read("index.html");
      const handlers = Array.from(extractInlineHandlers(html));

      const missing = handlers.filter((name) => !isHandlerExposed(core, name));
      assert.strictEqual(
        missing.length,
        0,
        `Inline handlers missing in core: ${missing.join(", ")}`
      );
    }
  }
];

module.exports = { tests };
