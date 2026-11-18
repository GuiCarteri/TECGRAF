import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const base = process.env.UI_TEST_URL || "http://127.0.0.1:5180";
  let deletes = 0, fail = false;
  const file = { id: "fixture", original_name: "synthetic.dlis", status: "validated", collection: "Test", metadata: null };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api/", "");
    if (route.request().method() === "DELETE") {
      assert.equal(path, "files/fixture");
      deletes++;
      await route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: "NETWORK_ERROR" } : { ok: true } });
    } else await route.fulfill({ json: {
      me: { user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin" } },
      analyses: { analyses: [] }, history: { history: [] }, exports: { exports: [] },
      "my-files": { files: [file] }, "admin/files": { files: [file] }, "admin/users": { users: [] },
    }[path] || {} });
  });
  await page.goto(base + "/account");
  await page.getByRole("tab", { name: "Publicações" }).click();
  const button = page.getByRole("button", { name: "Apagar publicação", exact: true });
  await button.waitFor();
  page.once("dialog", dialog => dialog.dismiss());
  await button.click();
  assert.equal(deletes, 0);
  assert.equal(await button.count(), 1);
  fail = true;
  page.once("dialog", dialog => dialog.accept());
  await Promise.all([page.waitForResponse(response => response.request().method() === "DELETE"), button.click()]);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.includes("Apagar publicação") && !button.disabled));
  assert.equal(deletes, 1);
  assert.equal(await button.count(), 1);
  fail = false;
  page.once("dialog", dialog => dialog.accept());
  await button.click();
  await button.waitFor({ state: "detached" });
  assert.equal(deletes, 2);
  await page.goto(base + "/admin");
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  page.once("dialog", dialog => dialog.accept());
  await button.click();
  await button.waitFor({ state: "detached" });
  assert.equal(deletes, 3);
  assert.deepEqual(errors, []);
  console.log("PASS: account/admin deletion, cancellation, server failure/retry, null metadata and no browser errors");
} finally { await browser.close(); }
