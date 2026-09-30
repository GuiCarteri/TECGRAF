import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const server = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "--host", "127.0.0.1", "--port", "5190", "--strictPort"], {
  env: {
    ...process.env,
    CLOUDFLARE_CF_FETCH_ENABLED: "false",
    WRANGLER_SEND_METRICS: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(logs)), 30000);
    const inspect = () => {
      if (logs.includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on("data", inspect);
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Server stopped: " + code + "\n" + logs));
    });
  });
  const root = "http://127.0.0.1:5190";
  for (const [locale, label] of [
    ["pt-BR", "Biblioteca pública"],
    ["en", "Public library"],
    ["zh-CN", "公共资料库"],
    ["es", "Biblioteca pública"],
  ]) {
    const r = await fetch(root, {
      headers: { Cookie: "strata_locale=" + locale },
    });
    const html = await r.text();
    assert.equal(r.status, 200, html.slice(0, 300));
    assert.ok(html.includes('lang="' + locale + '"'));
    assert.ok(html.includes(label));
    console.log("PASS: initial SSR language " + locale);
  }
  const guard = await fetch(root + "/viewer?file=abc", { redirect: "manual" });
  assert.equal(guard.status, 307);
  assert.match(guard.headers.get("location"), /login.*next/);
  assert.equal((await fetch(root + "/login")).status, 200);
  console.log(
    "PASS: public login and protected page redirect with destination.",
  );
} finally {
  server.kill("SIGTERM");
}
