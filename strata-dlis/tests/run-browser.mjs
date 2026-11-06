// Starts the isolated UI fixture and its test in the same network namespace.
import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--config", "tests/browser/vite.config.ts"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(logs || "UI server timed out")),
      30000,
    );
    server.stdout.on("data", () => {
      if (logs.includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`UI server exited ${code}: ${logs}`));
    });
  });
  const test = spawn(
    process.execPath,
    [process.argv[2] || "tests/browser.mjs"],
    { stdio: "inherit", env: process.env },
  );
  const code = await new Promise((resolve) => test.once("exit", resolve));
  if (code !== 0) process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
