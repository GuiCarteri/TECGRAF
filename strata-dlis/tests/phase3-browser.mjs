import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { makeFixture } from "./fixtures/dlis.mjs";

const base = "http://127.0.0.1:5180";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  colorScheme: "light",
  viewport: { width: 1440, height: 960 },
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const file = {
  id: "synthetic-horizon",
  collection: "STRATA",
  well: "Poço sintético Horizonte",
  field: "Campo experimental",
  original_name: "horizonte.dlis",
  size: 9856,
  types: ["CBL", "VDL"],
  location: "onshore",
  published_at: "2026-01-15",
  publisher: "STRATA",
};
await page.route("**/api/**", (route) => {
  const path = new URL(route.request().url()).pathname;
  return route.fulfill({
    json:
      path === "/api/files"
        ? { files: [file] }
        : {
            user: {
              id: "synthetic",
              name: "Horizonte",
              email: "horizon@example.test",
              role: "admin",
            },
            configured: true,
            analyses: [],
            history: [],
            exports: [],
            files: [],
            users: [],
          },
  });
});
async function accessibility() {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.map((rule) => ({
      rule: rule.id,
      elements: rule.nodes.map((node) => node.target),
    }));
  });
  assert.deepEqual(
    violations,
    [],
    page.url() + " " + JSON.stringify(violations),
  );
}
const theme = page.locator(".theme-select");
const lang = page.locator(".language-selector select");
const search = page.getByRole("combobox", {
  name: /Buscar poço|Search wells|Buscar pozo/,
});
async function contrast(selector) {
  const ratio = await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const numbers = (color) =>
        color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      const luminance = (color) =>
        numbers(color).reduce((sum, n, i) => {
          const c = n / 255;
          return (
            sum +
            [0.2126, 0.7152, 0.0722][i] *
              (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
          );
        }, 0);
      let ancestor = element;
      while (
        ancestor &&
        getComputedStyle(ancestor).backgroundColor === "rgba(0, 0, 0, 0)"
      )
        ancestor = ancestor.parentElement;
      const a = luminance(getComputedStyle(element).color),
        b = luminance(getComputedStyle(ancestor).backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  assert.ok(ratio >= 4.5, selector + " " + ratio);
  return ratio.toFixed(2);
}
async function checkWidth() {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "overflow: " + page.url() + " at " + page.viewportSize().width,
  );
}
const cardBackground = () =>
  page
    .locator(".file-card")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
try {
  await mkdir("test-results", { recursive: true });
  await page.goto(base);
  await page.locator(".file-card").first().waitFor();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "main-content",
  );
  const light = await cardBackground();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.waitForFunction(
    (light) =>
      getComputedStyle(document.querySelector(".file-card")).backgroundColor !==
      light,
    light,
  );
  const dark = await cardBackground();
  await page.evaluate(() => scrollTo(0, 0));
  for (const mode of ["light", "dark"]) {
    await theme.selectOption(mode);
    await page.waitForFunction(
      (mode) => document.documentElement.dataset.theme === mode,
      mode,
    );
    assert.equal(await cardBackground(), mode === "light" ? light : dark);
    const samples = [];
    for (const selector of [
      ".file-card h3",
      ".file-card dt",
      ".field-label",
      ".eyebrow",
      ".topnav a.active",
      ".theme-select",
    ])
      samples.push(await contrast(selector));
    console.log(
      mode + " · contraste do texto em seis elementos: " + samples.join(", "),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/phase3-library-" + mode + ".png",
    });
  }
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  await page.locator(".command-trigger").focus();
  await page.keyboard.press("Control+k");
  await search.fill("horizonte");
  await page.getByRole("option", { name: /Horizonte/ }).waitFor();
  await accessibility();
  await page.screenshot({ path: "test-results/phase3-command.png" });
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .locator(".command-trigger")
      .evaluate((el) => document.activeElement === el),
    true,
  );
  await page.keyboard.press("Meta+k");
  await search.fill("tema");
  await search.press("ArrowDown");
  await search.press("Enter");
  assert.equal(await theme.inputValue(), "light");
  await page.keyboard.press("Control+k");
  await search.fill("English");
  await search.press("Enter");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await page.keyboard.press("Control+k");
  await search.fill("horizonte");
  await search.press("Enter");
  await page.waitForURL("**/viewer?file=synthetic-horizon");
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic.dlis",
    mimeType: "application/octet-stream",
    buffer: makeFixture(),
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".track-plot canvas").length === 4,
  );
  const canvas = page.locator(".cbl-track canvas").first();
  async function canvasBackground() {
    return canvas.evaluate((c) =>
      [...c.getContext("2d").getImageData(2, 3, 1, 1).data].join(),
    );
  }
  await theme.selectOption("light");
  await page.waitForFunction(
    () =>
      document
        .querySelector(".cbl-track canvas")
        .getContext("2d")
        .getImageData(2, 3, 1, 1).data[0] === 255,
  );
  const before = await canvasBackground();
  await theme.selectOption("dark");
  await page.waitForFunction(
    () =>
      document
        .querySelector(".cbl-track canvas")
        .getContext("2d")
        .getImageData(2, 3, 1, 1).data[0] === 24,
  );
  assert.notEqual(await canvasBackground(), before);
  await accessibility();
  await lang.selectOption("es");
  assert.equal(await page.locator(".track-plot canvas").count(), 4);
  for (const width of [320, 390, 768, 1100]) {
    await page.setViewportSize({ width, height: 850 });
    for (const path of [
      "/",
      "/login",
      "/help",
      "/viewer",
      "/publish",
      "/account",
      "/admin",
    ]) {
      await page.goto(base + path);
      await theme.waitFor();
      await page.locator("main h1").first().waitFor();
      await checkWidth();
      if (width === 390 || width === 1100) {
        await theme.selectOption(width === 390 ? "light" : "dark");
        await accessibility();
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await theme.selectOption("dark");
  await page.locator(".file-card").first().waitFor();
  await page.screenshot({ path: "test-results/phase3-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS Teclado, foco, contraste, paleta, busca de poço, navegação, tema do sistema, movimento reduzido, Canvas e sete telas em quatro larguras.",
  );
} finally {
  await browser.close();
}
