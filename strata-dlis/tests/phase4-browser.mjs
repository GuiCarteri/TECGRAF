import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { makeFixture } from "./fixtures/dlis.mjs";

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1500, height: 1050 },
  locale: "pt-BR",
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const uploads = [];
page.on("request", (req) => {
  if (req.url().includes("/api/") && req.method() !== "GET")
    uploads.push(req.url());
});
await page.route("**/api/**", (r) =>
  r.fulfill({ json: { user: { id: "qa", role: "user" }, analyses: [] } }),
);
const dir = "test-results/phase4";
await mkdir(dir, { recursive: true });
const fixture = (well, offset = 0) => ({
  name: well + ".dlis",
  mimeType: "application/octet-stream",
  buffer: makeFixture({
    rows: 1000,
    wellName: well,
    depthOffset: offset,
    petrophysics: true,
  }),
});
try {
  await page.goto("http://127.0.0.1:5180/viewer");
  await page
    .locator("input[type=file]")
    .setInputFiles(fixture("Aurora · sintético"));
  await page.waitForFunction(
    () => document.querySelectorAll(".track-plot canvas").length === 11,
  );
  await page
    .getByRole("button", { name: "Perfil composto", exact: true })
    .click();
  const panel = page.locator(".profile-panel"),
    canvas = panel.locator("canvas").first();
  await panel
    .locator("summary")
    .filter({ hasText: "Escalas e paleta" })
    .click();
  const log = panel.getByRole("combobox", { name: /Escala visual ILD/ });
  assert.equal(await log.inputValue(), "log");
  await log.selectOption("linear");
  await panel.getByLabel("Paleta para daltonismo").check();
  await page.locator(".theme-select").selectOption("dark");
  await panel
    .locator("summary")
    .filter({ hasText: "Escalas e paleta" })
    .click();
  await panel.getByRole("button", { name: "Formações e litologia" }).click();
  await panel.getByLabel("Nome da formação").fill("Topo A · sintético");
  await panel
    .getByLabel("Litologia", { exact: true })
    .selectOption("sandstone");
  await panel.getByLabel("De (m)", { exact: true }).fill("1005");
  await panel.getByLabel("Até (m)", { exact: true }).fill("1010");
  await panel.getByRole("button", { name: "Adicionar marcador" }).click();
  await panel.getByRole("button", { name: "Formações e litologia" }).click();
  await panel.getByRole("button", { name: "Aproximar perfil" }).click();
  await panel.getByRole("button", { name: "Régua", exact: true }).click();
  await canvas.focus();
  await canvas.press("ArrowDown");
  await canvas.press("Enter");
  await canvas.press("ArrowDown");
  await canvas.press("Enter");
  assert.match(await panel.locator("output").textContent(), /Δ/);
  await panel.getByRole("button", { name: "Modo apresentação" }).click();
  const slider = panel.getByRole("slider");
  const start = await slider.inputValue();
  await page.waitForFunction(
    (v) => document.querySelector(".profile-minimap input").value !== v,
    start,
  );
  await panel.getByRole("button", { name: "Modo apresentação" }).click();
  await panel.getByRole("button", { name: "Comparar poços" }).click();
  await panel
    .locator("input[type=file]")
    .setInputFiles(fixture("Boreal · sintético", 5));
  await page.waitForFunction(
    () => document.querySelectorAll(".profile-column canvas").length === 2,
  );
  await canvas.focus();
  await canvas.press("ArrowDown");
  assert.equal(await panel.locator(".profile-readings").count(), 2);
  await panel.getByRole("button", { name: "Toda a profundidade" }).click();
  const evidence = process.env.PHASE4_EVIDENCE;
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await panel.screenshot({
      path: evidence + "/phase4-compare.jpg",
      type: "jpeg",
      quality: 85,
    });
  }
  if (evidence) {
    await page.locator(".theme-select").selectOption("light");
    await panel.getByRole("button", { name: "Comparar poços" }).click();
    await panel
      .locator(".sheet-scroll")
      .first()
      .evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
    await panel.screenshot({
      path: evidence + "/phase4-curves.jpg",
      type: "jpeg",
      quality: 86,
    });
    await panel.getByRole("button", { name: "Comparar poços" }).click();
    await panel
      .locator("input[type=file]")
      .setInputFiles(fixture("Boreal · sintético", 5));
    await page.waitForFunction(
      () => document.querySelectorAll(".profile-column canvas").length === 2,
    );
  }
  for (const format of ["svg", "png", "pdf"]) {
    const pending = page.waitForEvent("download");
    await panel
      .getByRole("button", { name: format.toUpperCase(), exact: true })
      .click();
    const dl = await pending;
    const dest = dir + "/profile." + format;
    await dl.saveAs(dest);
    const bytes = await readFile(dest);
    if (format === "pdf") {
      assert.match(bytes.toString("latin1"), /^%PDF-1.4/);
      assert.match(bytes.toString("latin1"), /\/Count 2/);
      assert.ok(bytes.includes(Buffer.from("%%EOF")));
    }
    if (format === "svg") {
      const xml = bytes.toString();
      assert.ok(
        xml.includes("Aurora") &&
          xml.includes("Boreal") &&
          xml.includes("Topo A"),
      );
      assert.match(xml, /<path /);
      assert.match(xml, /<image /);
      assert.match(xml, /Crossover/);
      assert.match(xml, /g\/cm³/);
      assert.equal(
        await page.evaluate(
          (xml) =>
            new DOMParser()
              .parseFromString(xml, "image/svg+xml")
              .querySelectorAll("parsererror").length,
          xml,
        ),
        0,
      );
    }
    if (format === "png") {
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      assert.ok(bytes.readUInt32BE(16) > 3000 && bytes.readUInt32BE(20) > 2000);
    }
    console.log(format + " · " + bytes.length + " bytes");
  }
  const metrics = await page.evaluate(async () => {
    const { benchmark } = await import("/profile-benchmark.ts");
    return benchmark();
  });
  assert.ok(metrics.renderedIndices <= 1240);
  console.log(JSON.stringify(metrics));
  assert.deepEqual(errors, []);
  assert.deepEqual(uploads, []);
  console.log(
    "PASS 11 trilhas, escalas, cores, comparação em profundidade, régua, marcador, litologia, crossover, apresentação e exportações.",
  );
} finally {
  await browser.close();
}
