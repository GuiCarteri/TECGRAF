import { stripVTControlCharacters } from "node:util";
import { spawn } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";
const host = "strata-test-5174.app.github.dev";
const server = spawn(
  process.execPath,
  ["scripts/dev.mjs", "--host", "127.0.0.1", "--port", "5174"],
  {
    env: {
      ...process.env,
      CODESPACES: "true",
      CODESPACE_NAME: "strata-test",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      WRANGLER_SEND_METRICS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
server.stdout.on("data", (data) => (logs += data));
server.stderr.on("data", (data) => (logs += data));
function request(path, headers = {}, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5174,
        path,
        method,
        headers: { Host: host, "X-Forwarded-Proto": "https", ...headers },
      },
      (response) => {
        let text = "";
        response.on("data", (data) => (text += data));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            text,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(logs.slice(-3000))), 60000);
    const inspect = () => {
      if (stripVTControlCharacters(logs).includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on("data", inspect);
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Startup exited ${code}: ${logs.slice(-3000)}`));
    });
  });
  const catalog = await request("/api/files");
  assert.equal(catalog.status, 200, catalog.text);
  assert.ok(
    Array.isArray(JSON.parse(catalog.text).files),
    "manual start initializes the same D1 database used by Vite",
  );
  for (const path of [
    "/",
    "/help",
    "/login",
    "/favicon.svg",
    "/api/me",
    "/api/auth/config",
  ]) {
    assert.equal((await request(path)).status, 200, path);
  }
  assert.deepEqual(JSON.parse((await request("/api/me")).text), { user: null });
  for (const path of ["/viewer", "/publish", "/account", "/admin"]) {
    const response = await request(path);
    assert.equal(response.status, 307, path);
    const login = new URL(response.headers.location, "https://" + host);
    assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("next"), path);
  }
  const register = await request("/register");
  assert.equal(register.status, 307);
  assert.match(register.headers.location, /mode=register/);
  assert.equal((await request("/missing-strata-page")).status, 404);
  assert.equal((await request("/api/missing-strata-route")).status, 404);
  console.log(
    "PASS: public pages, API and favicon 200; guest redirects 307; unknown page and API 404",
  );
  const locale = await request("/api/locale?lang=en", {
    Referer: `https://${host}/login?next=%2Faccount`,
  });
  assert.equal(locale.status, 303);
  assert.equal(locale.headers.location, "/login?next=%2Faccount");
  assert.match(
    locale.headers["set-cookie"].join(";"),
    /strata_locale=en;.*Secure/,
  );
  const login = await request("/login", { Cookie: "strata_locale=en" });
  assert.equal(login.status, 200);
  assert.match(login.text, /lang="en"/);
  assert.match(login.text, /action="\/api\/auth\/login"/);
  assert.match(login.text, /name="email"/);
  assert.match(login.text, /name="password"/);
  const sameSite = await request(
    "/api/auth/login",
    { Origin: `https://${host}`, "Content-Type": "application/json" },
    "POST",
    "{}",
  );
  assert.ok(
    [400, 503].includes(sameSite.status),
    "forwarded HTTPS origin must not be rejected as CSRF",
  );
  const external = await request(
    "/api/auth/login",
    { Origin: "https://evil.test", "Content-Type": "application/json" },
    "POST",
    "{}",
  );
  assert.equal(external.status, 403);
  const duplicate = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5174"],
    {
      env: { ...process.env, CLOUDFLARE_CF_FETCH_ENABLED: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let duplicateLogs = "";
  duplicate.stdout.on("data", (b) => (duplicateLogs += b));
  duplicate.stderr.on("data", (b) => (duplicateLogs += b));
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      duplicate.kill();
      reject(new Error("Duplicate server did not stop"));
    }, 30000);
    duplicate.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  assert.notEqual(code, 0);
  assert.match(duplicateLogs, /5174.*already in use/i);
  console.log(
    "PASS: manual startup, local D1, explicit port, Codespaces HTTPS forwarding, native language form and CSRF",
  );
} finally {
  server.kill("SIGTERM");
}
