"use strict";

const assert = require("assert");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.join(__dirname, "..", "..");
const PORT = 8001;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port: PORT,
        path: pathname,
        timeout: 2000
      },
      (res) => {
        res.resume();
        resolve(res);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

async function waitForServer(timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await request("/");
      if (res.statusCode === 200) {
        return;
      }
    } catch (err) {
      await sleep(200);
    }
  }
  throw new Error("Server did not become ready on port 8001.");
}

const tests = [
  {
    name: "server serves key static assets",
    async run() {
      const child = spawn("node", ["server.js"], {
        cwd: repoRoot,
        stdio: "ignore"
      });

      let exited = false;
      child.on("exit", () => {
        exited = true;
      });

      try {
        await waitForServer();
        if (exited) {
          throw new Error(
            "server.js exited early. Port 8001 may already be in use."
          );
        }

        const targets = [
          "/",
          "/assets/main.js",
          "/assets/core/index.js",
          "/good-things-come.html",
          "/manifest.json"
        ];

        for (const target of targets) {
          const res = await request(target);
          assert.strictEqual(
            res.statusCode,
            200,
            `Expected 200 for ${target}, got ${res.statusCode}`
          );
        }
      } finally {
        child.kill();
        await sleep(200);
      }
    }
  }
];

module.exports = { tests };
