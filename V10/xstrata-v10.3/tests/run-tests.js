#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

async function run() {
  const testsDir = path.join(__dirname, "smoke");
  const files = fs
    .readdirSync(testsDir)
    .filter((file) => file.endsWith(".test.js"))
    .sort();

  let failures = 0;
  let total = 0;
  let passed = 0;

  for (const file of files) {
    const testPath = path.join(testsDir, file);
    const mod = require(testPath);
    const tests = Array.isArray(mod.tests)
      ? mod.tests
      : typeof mod.run === "function"
        ? [{ name: mod.name || "run", run: mod.run }]
        : [];

    if (tests.length === 0) {
      console.warn(`WARN: No tests exported in ${file}`);
      continue;
    }

    for (const test of tests) {
      const label = `${file}: ${test.name}`;
      total += 1;
      try {
        await test.run();
        console.log(`ok - ${label}`);
        passed += 1;
      } catch (err) {
        failures += 1;
        console.error(`not ok - ${label}`);
        console.error(err && err.stack ? err.stack : err);
      }
    }
  }

  if (failures > 0) {
    console.error(`\nScore: ${passed}/${total} passed.`);
    console.error(`FAIL: ${failures} test(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nScore: ${passed}/${total} passed.`);
    console.log("PASS: All tests completed successfully.");
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
