import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { makeFixture } from "./fixtures/dlis.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/api/"))
    requests.push({ url: r.url(), method: r.method() });
});
await page.route("**/api/**", (route) =>
  route.fulfill({
    json: {
      user: { id: "synthetic-user", role: "admin", name: "QA" },
      analyses: [],
      ok: true,
    },
  }),
);
mkdirSync("test-results", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5180/viewer");
  await page.screenshot({
    path: "test-results/viewer-empty-desktop.png",
    fullPage: true,
  });
  const start = Date.now();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-scientific.dlis",
      mimeType: "application/octet-stream",
      buffer: makeFixture(),
    });
  await page.waitForFunction(
    () => document.querySelectorAll(".track-plot canvas").length === 4,
  );
  const elapsed = Date.now() - start;
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".track-plot canvas")].every((c) => {
      const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 0; i < p.length; i += 4)
        if (p[i] < 200 || p[i + 1] < 200 || p[i + 2] < 200) ink++;
      return ink > 100;
    }),
  );
  await page.screenshot({
    path: "test-results/scientific-loaded-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator(".track-unavailable").count(), 0);
  assert.equal(await page.locator(".notice.error").count(), 0);
  assert.ok(
    !requests.some((r) => /history|analyses|uploads/.test(r.url)),
    "opening a local file must not sync metadata by default",
  );
  await page.getByLabel("Profundidade inicial em metros").fill("1020");
  await page.getByLabel("Profundidade final em metros").fill("1035");
  await page
    .locator(".track-plot canvas")
    .nth(2)
    .click({ position: { x: 50, y: 280 } });
  await page.locator(".waveform").waitFor();
  assert.equal(await page.locator(".points-table tbody tr").count(), 1);
  const before = await page
    .getByLabel("Profundidade inicial em metros")
    .inputValue();
  await page.getByLabel("Aproximar profundidade").click();
  assert.notEqual(
    await page.getByLabel("Profundidade inicial em metros").inputValue(),
    before,
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar gráfico PNG" })
    .nth(2)
    .click();
  const png = await download;
  assert.match(png.suggestedFilename(), /\.png$/);
  await png.saveAs("test-results/exported-vdl.png");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const csv = await csvDownload;
  assert.match(csv.suggestedFilename(), /\.csv$/);
  const count = await page.locator(".points-table tbody tr").count();
  for (const locale of ["en", "es", "zh-CN", "pt-BR"]) {
    await page.locator(".language-selector select").selectOption(locale);
    assert.equal(await page.locator(".points-table tbody tr").count(), count);
    assert.equal(await page.locator(".track-plot canvas").count(), 4);
  }
  await page.screenshot({
    path: "test-results/scientific-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({
    path: "test-results/scientific-tablet.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "page should not overflow horizontally",
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: "test-results/scientific-tablet-portrait.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "PASS",
      fixture: "Encoded synthetic RP66, actual Worker/parser (not mocked)",
      channels: ["GR", "CBL", "VDL", "AIBK"],
      load_ms: elapsed,
      checks: [
        "4 plots",
        "index precedence",
        "zoom",
        "original waveform",
        "PNG",
        "CSV",
        "four languages",
        "tablet landscape and portrait",
        "local privacy default",
      ],
    }),
  );
} finally {
  await page.screenshot({
    path: "test-results/scientific-last-state.png",
    fullPage: true,
  });
  await browser.close();
}
