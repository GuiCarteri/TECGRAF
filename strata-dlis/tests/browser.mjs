import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
// PLAYWRIGHT_MODULE is an optional external test-runner installation.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
mkdirSync("test-results", { recursive: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.UI_TEST_URL || "http://127.0.0.1:5180";
const user = {
  id: "test-only-user",
  name: "Test User",
  email: "test@example.test",
  role: "admin",
};
const frames = [
  {
    key: "frame-key",
    name: "FRAME-A",
    description: "",
    indexType: "BOREHOLE-DEPTH",
    channels: [
      {
        key: "depth-key",
        name: "DEPTH",
        units: "m",
        dimension: [1],
        kind: "DEPTH",
      },
      { key: "cbl-key", name: "CBL", units: "mV", dimension: [1], kind: "CBL" },
    ],
  },
];
const metadata = {
  hash: "a".repeat(64),
  version: "V1.00",
  warnings: [],
  logicalFiles: [
    {
      index: 0,
      id: "LF-A",
      origin: {
        wellName: "Well 原始",
        company: "Test",
        fieldName: "Test Field",
      },
      frames,
      parameters: [],
    },
  ],
};
let workerLoads = 0;
await page.route("**/workers/dlis.worker.ts*", async (route) => {
  workerLoads++;
  await route.fulfill({
    contentType: "text/javascript",
    body: `self.onmessage=({data})=>{const result=data.type==='parse'?${JSON.stringify(metadata)}:{frameCount:3,channels:${JSON.stringify(frames[0].channels)},strides:{DEPTH:1,CBL:1},frameNumbers:new Uint32Array([1,2,3]),data:{DEPTH:new Float64Array([1000,1001,1002]),CBL:new Float64Array([1.125,2.25,3.5])}};self.postMessage({id:data.id,result});};`,
  });
});
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const data = path.endsWith("/me")
    ? { user }
    : path.endsWith("/config")
      ? { configured: true }
      : path.includes("admin/users")
        ? { users: [user] }
        : path.includes("analyses")
          ? { analyses: [] }
          : path.includes("history")
            ? { history: [] }
            : path.includes("exports")
              ? { exports: [] }
              : path.includes("files")
                ? { files: [] }
                : { ok: true };
  await route.fulfill({ json: data });
});
try {
  await page.goto(base + "/viewer");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "fixture.dlis",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(84),
    });
  await page.getByRole("heading", { name: "Well 原始" }).waitFor();
  await page.locator("canvas").waitFor();
  await page.locator("canvas").click({ position: { x: 30, y: 310 } });
  await page.locator(".points-table tbody tr").waitFor();
  await page.getByLabel("Observação do ponto").fill("Nota original 中文");
  const filename = await page.locator(".viewer-heading p").textContent();
  const before = await page.locator(".points-table tbody tr").textContent();
  assert.ok(before.includes("2.25"));
  const loads = workerLoads;
  for (const locale of ["en", "zh-CN", "es", "pt-BR"]) {
    await page.locator(".language-selector select").selectOption(locale);
    await page.waitForFunction(
      (l) => document.documentElement.lang === l,
      locale,
    );
    assert.equal(
      await page.locator(".viewer-heading p").textContent(),
      filename,
    );
    assert.equal(await page.locator(".points-table tbody tr").count(), 1);
    assert.equal(
      await page.locator(".points-table input").inputValue(),
      "Nota original 中文",
    );
    assert.match(
      await page.locator(".points-table tbody tr").textContent(),
      /2.25/,
    );
    assert.equal(workerLoads, loads, "language must not recreate worker");
  }
  await page.locator(".language-selector select").selectOption("zh-CN");
  await page.screenshot({
    path: "test-results/viewer-zh-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/viewer-zh-mobile.png",
    fullPage: true,
  });
  for (const route of [
    "library",
    "login",
    "account",
    "admin",
    "publish",
    "help",
  ]) {
    await page.goto(base + "/" + route);
    await page.locator(".language-selector select").waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
    assert.equal(
      await page.locator(".language-selector select").inputValue(),
      "zh-CN",
    );
    await page.locator(".language-selector select").selectOption("es");
    await page.screenshot({
      path: "test-results/" + route + "-es-mobile.png",
      fullPage: true,
    });
    if (route === "login") {
      await page.locator("input[type=email]").fill("person@example.test");
      await page.locator("input[type=password]").fill("unchanged-password");
      await page.locator(".language-selector select").selectOption("en");
      assert.equal(
        await page.locator("input[type=email]").inputValue(),
        "person@example.test",
      );
      assert.equal(
        await page.locator("input[type=password]").inputValue(),
        "unchanged-password",
      );
    }
    await page.locator(".language-selector select").selectOption("zh-CN");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: all four languages; file, raw point, note, worker and login form preserved; language cookie persists across all principal pages; mobile screenshots captured. Synthetic worker responses, not a real DLIS regression.",
  );
} finally {
  await browser.close();
}
