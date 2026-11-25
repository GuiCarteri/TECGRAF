// Optional local regression: never writes file metadata or screenshots of user files.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
if (!process.env.DLIS_TEST_DIR)
  throw new Error("Set DLIS_TEST_DIR to an authorized local directory.");
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const seen = new Set(),
  reports = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", (route) =>
  route.fulfill({
    json: { user: { id: "synthetic-user", role: "admin" }, analyses: [] },
  }),
);
try {
  await page.goto("http://127.0.0.1:5180/viewer");
  for (const name of readdirSync(process.env.DLIS_TEST_DIR).filter((n) =>
    /\.dlis$/i.test(n),
  )) {
    const path = join(process.env.DLIS_TEST_DIR, name),
      hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (seen.has(hash)) continue;
    seen.add(hash);
    const start = Date.now();
    await page.locator("input[type=file]").setInputFiles(path);
    await page.waitForFunction(
      () => document.querySelectorAll(".track-plot canvas").length === 4,
      {},
      { timeout: 60000 },
    );
    await page.locator(".notice[role=status]").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".notice.error").count(), 0);
    assert.equal(await page.locator(".track-unavailable").count(), 0);
    const time = Date.now() - start;
    await page.locator(".track-plot canvas").nth(2).press("+");
    await page.locator(".language-selector select").selectOption("en");
    let checked = 0;
    if (process.env.DLIS_REFERENCE_PYTHON) {
      await page.getByRole("button", { name: "Composite log" }).click();
      const canvas = page.locator(".profile-column canvas").first();
      await canvas.focus();
      await canvas.press("ArrowDown");
      const rows = page.locator(".profile-readings [data-channel]");
      const requests = await rows.evaluateAll((nodes) =>
        nodes.map((node) => ({ ...node.dataset })),
      );
      const reference = JSON.parse(
        execFileSync(
          process.env.DLIS_REFERENCE_PYTHON,
          ["tests/profile-reference.py", path],
          { input: JSON.stringify(requests), encoding: "utf8" },
        ),
      );
      for (const [i, expected] of reference.entries()) {
        assert.equal(requests[i].unit, expected.unit);
        await page.getByLabel("Inspect depth (m)").fill(String(expected.depth));
        await page
          .getByRole("button", { name: "Inspect", exact: true })
          .click();
        const wanted =
          new Intl.NumberFormat("en", { maximumSignificantDigits: 8 }).format(
            expected.value,
          ) +
          " " +
          expected.unit;
        await page.waitForFunction(
          ({ i, wanted }) =>
            document.querySelectorAll(".profile-readings [data-channel] dd")[i]
              ?.textContent === wanted,
          { i, wanted },
        );
        checked++;
      }
      await page
        .getByRole("button", { name: "Point reading", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Close file" }).click();
    assert.equal(await page.locator(".track-plot canvas").count(), 0);
    await page.locator(".language-selector select").selectOption("pt-BR");
    reports.push({
      case: reports.length + 1,
      bytes: statSync(path).size,
      open_and_plot_ms: time,
      plots: 4,
      reference_points: checked,
      closed: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", cases: reports }));
} finally {
  await browser.close();
}
