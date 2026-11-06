// Screenshots use synthetic identity/catalog; the actual DLIS worker is preserved.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { makeFixture } from "./fixtures/dlis.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const output = process.env.EVIDENCE_DIR || "test-results/comparison";
mkdirSync(output, { recursive: true });
const user = {
  id: "qa-synthetic",
  name: "Pesquisador de teste",
  email: "qa@example.test",
  role: "admin",
};
await page.route("**/api/**", (route) =>
  route.fulfill({
    json: {
      user,
      users: [user],
      files: [],
      analyses: [],
      history: [],
      exports: [],
      configured: true,
      ok: true,
    },
  }),
);
try {
  for (const route of [
    "login",
    "library",
    "publish",
    "admin",
    "help",
    "viewer",
  ]) {
    await page.goto("http://127.0.0.1:5180/" + route);
    await page.locator(".language-selector select").selectOption("pt-BR");
    await page.getByRole("main").waitFor();
    await page.screenshot({
      path: join(output, route + ".png"),
      fullPage: true,
    });
  }
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-scientific.dlis",
      mimeType: "application/octet-stream",
      buffer: makeFixture(),
    });
  await page.waitForFunction(() =>
    document
      .querySelector(".viewer-heading p")
      ?.textContent?.includes("synthetic-scientific"),
  );
  await page.waitForFunction(
    () => !document.body.textContent.includes("Lendo estrutura"),
  );
  await page.screenshot({
    path: join(output, "viewer-loaded.png"),
    fullPage: true,
  });
  console.log("PASS: synthetic before/after screenshots captured");
} finally {
  await browser.close();
}
