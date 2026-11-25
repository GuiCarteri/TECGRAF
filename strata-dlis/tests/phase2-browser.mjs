import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify, stripVTControlCharacters } from "node:util";
import { mkdir, mkdtemp, cp, symlink, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { chromium } from "playwright";
import { makeFixture } from "./fixtures/dlis.mjs";

const root = resolve("."),
  temp = await mkdtemp(join(tmpdir(), "strata-phase2-"));
const port = 5189,
  base = "http://127.0.0.1:" + port;
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: "false",
  CLOUDFLARE_CF_FETCH_ENABLED: "false",
};
delete env.SUPABASE_URL;
delete env.SUPABASE_ANON_KEY;
const cli = promisify(execFile);
let server,
  browser,
  db,
  logs = "",
  tab;
const expectedWell = "Poço sintético Horizonte";
const email = "horizonte@example.test",
  password = randomUUID(),
  newPassword = randomUUID();
try {
  // O teste usa apenas código da aplicação e dados temporários próprios.
  for (const file of [
    "app",
    "components",
    "db",
    "drizzle",
    "lib",
    "public",
    "scripts",
    "styles",
    "workers",
    "vendor",
    "package.json",
    "postcss.config.mjs",
    "vite.config.ts",
    "tsconfig.json",
    "wrangler.json",
    ".env.example",
  ])
    await cp(join(root, file), join(temp, file), { recursive: true });
  const modules = join(temp, "node_modules");
  await mkdir(modules);
  for (const name of await readdir(join(root, "node_modules"))) {
    if (name.startsWith(".") && ![".pnpm", ".bin"].includes(name)) continue;
    await symlink(join(root, "node_modules", name), join(modules, name), "dir");
  }
  server = spawn(
    process.execPath,
    ["scripts/dev.mjs", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: temp, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (s) => (logs += s));
  server.stderr.on("data", (s) => (logs += s));
  await new Promise((yes, no) => {
    const timer = setTimeout(
      () => no(Error("Tempo de inicialização esgotado.")),
      60000,
    );
    server.stdout.on("data", () => {
      if (stripVTControlCharacters(logs).includes("Local:")) {
        clearTimeout(timer);
        yes();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      no(Error("Vite encerrou: " + code));
    });
  });
  const config = await (await fetch(base + "/api/auth/config")).json();
  assert.equal(config.provider, "local");
  const d1dir = join(temp, ".wrangler/state/v3/d1");
  for (const filename of await readdir(d1dir, { recursive: true })) {
    if (!filename.endsWith(".sqlite")) continue;
    const candidate = new DatabaseSync(join(d1dir, filename));
    if (
      candidate
        .prepare("SELECT name FROM sqlite_master WHERE name='local_accounts'")
        .get()
    ) {
      db = candidate;
      break;
    }
    candidate.close();
  }
  assert.ok(db);
  browser = await chromium.launch({
    headless: true,
    executablePath: env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ locale: "pt-BR",
      viewport: { width: 1440, height: 1050 },
    }),
    page = await ctx.newPage();
  tab = page;
  const guest = await browser.newContext({ locale: "pt-BR",
      viewport: { width: 1440, height: 1050 },
    }),
    library = await guest.newPage();
  const crashes = [];
  for (const p of [page, library])
    p.on("pageerror", (e) => crashes.push(e.message));
  const api = (path, body) =>
    ctx.request.post(base + "/api/" + path, {
      data: body,
      headers: { Origin: base },
    });
  const me = async () =>
    (await (await ctx.request.get(base + "/api/me")).json()).user;
  const mail = async () => {
    const { stdout } = await cli(
      process.execPath,
      ["scripts/local.mjs", "mail", email],
      { cwd: temp, env },
    );
    return stdout.match(/(?:Confirmação|Recuperação) · (\d{6})/)?.[1];
  };
  await library.goto(base + "/");
  assert.equal((await guest.request.get(base + "/api/files")).status(), 200);
  assert.equal((await guest.request.get(base + "/api/my-files")).status(), 401);
  await page.goto(base + "/publish");
  await page.waitForURL(/\/login\?next=/);
  await page.goto(base + "/login?mode=register&next=%2Faccount");
  await page.getByLabel("Nome", { exact: true }).fill("Horizonte");
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page
    .getByRole("button", { name: "Criar conta", exact: true })
    .first()
    .click();
  await page.locator('[autocomplete="one-time-code"]').waitFor();
  const confirm = await mail();
  assert.ok(confirm);
  await page.locator('[autocomplete="one-time-code"]').fill(confirm);
  await page.getByRole("button", { name: "Confirmar código" }).click();
  await page.waitForURL(/\/account/);
  assert.equal((await me()).role, "user");
  assert.ok(
    db
      .prepare("SELECT password_hash FROM local_accounts")
      .get()
      .password_hash.startsWith("argon2id-v19-m19456-t2-p1$"),
  );
  const storeTheme = page.waitForResponse(response => response.url().endsWith("/api/preferences") && response.request().method()==="POST");
  await page.locator(".theme-select").selectOption("dark");
  assert.equal((await storeTheme).status(),204);
  const state = await ctx.storageState();
  assert.ok(
    state.cookies
      .filter((c) => ["strata_access", "strata_refresh"].includes(c.name))
      .every(
        (c) =>
          c.httpOnly && c.sameSite === "Lax" && c.expires > Date.now() / 1000,
      ),
  );
  const restored = await browser.newContext({ locale: "pt-BR", storageState: state });
  assert.equal(
    (await (await restored.request.get(base + "/api/me")).json()).user.email,
    email,
  );
  await restored.clearCookies({name:"strata_theme"});
  const restoredPage = await restored.newPage();
  await restoredPage.goto(base + "/account");
  assert.equal(await restoredPage.locator("html").getAttribute("data-theme"),"dark");
  await restored.close();
  assert.equal((await api("auth/logout", {})).status(), 200);
  assert.equal(await me(), null);
  assert.equal(
    (await api("auth/login", { email, password: "invalid-password" })).status(),
    401,
  );
  assert.equal((await api("auth/login", { email, password })).status(), 200);
  assert.equal(
    (
      await api("auth/verify", { email, token: confirm, type: "signup" })
    ).status(),
    400,
  );
  db.prepare("UPDATE local_sessions SET access_until=0").run();
  assert.equal((await ctx.request.get(base + "/api/me")).status(), 401);
  assert.equal((await api("auth/refresh", {})).status(), 200);
  assert.equal((await me()).email, email);
  db.prepare("UPDATE local_sessions SET access_until=0,refresh_until=0").run();
  assert.equal((await api("auth/refresh", {})).status(), 401);
  await api("auth/recover", { email });
  const recovery = await mail();
  assert.ok(recovery);
  assert.equal(
    (
      await api("auth/verify", { email, token: recovery, type: "recovery" })
    ).status(),
    200,
  );
  assert.equal(
    (
      await api("auth/change-password", { email, password: newPassword })
    ).status(),
    200,
  );
  await api("auth/logout", {});
  assert.equal((await api("auth/login", { email, password })).status(), 401);
  assert.equal(
    (await api("auth/login", { email, password: newPassword })).status(),
    200,
  );
  assert.equal(
    (
      await ctx.request.post(base + "/api/auth/logout", {
        headers: { Origin: "https://other.example" },
        data: {},
      })
    ).status(),
    403,
  );
  await me();
  await cli(process.execPath, ["scripts/local.mjs", "role", email, "admin"], {
    cwd: temp,
    env,
  });
  console.log(
    "PASS cadastro e caixa local, Argon2id, cookies, login válido/inválido, persistência, renovação, expiração, recuperação, logout, CSRF e rotas protegidas.",
  );
  await page.goto(base + "/publish");
  await page.waitForSelector("input[type=file]:enabled", { state: "attached" });
  const bytes = makeFixture({
    rows: 121,
    wellName: expectedWell,
    catalogDetails: true,
  });
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "incompleto.dlis",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(86),
    },
    {
      name: "horizonte.dlis",
      mimeType: "application/octet-stream",
      buffer: bytes,
    },
  ]);
  await page.getByText(/incompleto\.dlis · /).waitFor();
  await page.getByRole("button", { name: /Próximo arquivo/ }).click();
  await page.getByRole("heading", { name: "Confirme os metadados" }).waitFor();
  assert.equal(
    await page.getByLabel("Nome do poço", { exact: true }).inputValue(),
    expectedWell,
  );
  await page.getByLabel(/Coleção \/ fonte/).fill("Ensaios sintéticos");
  await page.getByRole("checkbox").nth(0).click();
  await page.getByRole("checkbox").nth(1).click();
  await page.getByRole("button", { name: "Revisar publicação" }).click();
  let completions = 0;
  await page.route("**/api/uploads/*/complete", async (route) => {
    completions++;
    if (completions === 1) {
      assert.equal((await route.fetch()).status(), 200);
      await route.fulfill({ status: 503, json: { error: "NETWORK_ERROR" } });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page
    .getByRole("heading", { name: "Arquivo recebido para revisão." })
    .waitFor();
  assert.equal(completions, 2);
  const saved = (await (await ctx.request.get(base + "/api/my-files")).json())
    .files[0];
  assert.equal(saved.metadata.validation[0].samples, 121);
  assert.equal(
    (await (await guest.request.get(base + "/api/files")).json()).files.length,
    0,
  );
  assert.equal(
    (
      await api("uploads", {
        hash: createHash("sha256").update(bytes).digest("hex"),
        name: "copia.dlis",
        size: bytes.length,
      })
    ).status(),
    409,
  );
  assert.equal(
    (await api("uploads/" + saved.id + "/complete", {})).status(),
    200,
  );
  await page.goto(base + "/admin");
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  db.prepare("UPDATE files SET metadata='{}' WHERE id=?").run(saved.id);
  assert.equal(
    (
      await guest.request.post(base + "/api/files/" + saved.id + "/reindex", {
        data: {},
      })
    ).status(),
    401,
  );
  const [reindexed] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/reindex")),
    dialog.getByRole("button", { name: "Reindexar DLIS" }).click(),
  ]);
  assert.equal(reindexed.status(), 200);
  assert.equal(
    JSON.parse(
      db
        .prepare("SELECT summary FROM catalog_index WHERE file_id=?")
        .get(saved.id).summary,
    ).samples,
    121,
  );
  await dialog
    .getByRole("textbox", { name: /Parecer/ })
    .fill("Dados sintéticos e autorização conferidos.");
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Aprovar publicação" }).click();
  await dialog.waitFor({ state: "hidden" });
  // Uma sessão de convidado separada precisa receber a atualização sem recarregar a página.
  await library
    .getByRole("heading", { name: expectedWell })
    .waitFor({ timeout: 40000 });
  const filtered = async (q) =>
    (await (await guest.request.get(base + "/api/files?" + q)).json()).files;
  const [record] = await filtered(
    "well=Horizonte&field=Delta&curve=GR&tool=QA-GR&minDepth=1012&maxDepth=1012",
  );
  assert.equal(record.id, saved.id);
  assert.equal(record.summary.samples, 121);
  assert.deepEqual(record.summary.ranges, [[1000, 1012]]);
  assert.equal(record.summary.frameCount, 1);
  assert.ok(
    record.summary.channels.some((c) => c.name === "GR" && c.unit === "gAPI"),
  );
  assert.deepEqual(record.summary.dates, ["2026-03-15T12:30:00.000Z"]);
  assert.equal(record.summary.thumbnail.channel, "GR");
  assert.deepEqual(record.summary.thumbnail.points[0], [80, 1000]);
  for (const q of [
    "minDepth=2000",
    "curve=XYZ",
    "tool=missing",
    "field=absent",
    "well=absent",
  ])
    assert.equal((await filtered(q)).length, 0);
  assert.equal(
    (
      await guest.request.get(base + "/api/files?minDepth=15&maxDepth=1")
    ).status(),
    400,
  );
  await library.getByText("Filtros técnicos", { exact: true }).click();
  await library.getByLabel("Ferramenta", { exact: true }).fill("QA-GR");
  await library.getByLabel("Curva", { exact: true }).fill("GR");
  await library.getByText("Metadados do DLIS", { exact: true }).click();
  assert.equal(await library.locator(".curve-thumbnail svg").count(), 1);
  if (env.PHASE3_EVIDENCE) {
    await mkdir(env.PHASE3_EVIDENCE, {recursive:true});
    for (const theme of ["light","dark"]) {
      await library.locator(".theme-select").selectOption(theme);
      await library.evaluate(() => scrollTo(0,0));
      await library.screenshot({path:join(env.PHASE3_EVIDENCE,"phase3-"+theme+".jpg"), quality:82,animations:"disabled", fullPage:true});
    }
    await library.keyboard.press("Control+k");
    await library.getByRole("combobox",{name:"Buscar poço, página ou preferência"}).fill("Horizonte");
    await library.getByRole("option",{name:/Horizonte/}).waitFor();
    await library.screenshot({path:join(env.PHASE3_EVIDENCE,"phase3-palette.jpg"), quality:82});
    await library.keyboard.press("Escape");
  }
  if (env.PHASE2_SCREENSHOT)
    await library.screenshot({
      path: resolve(env.PHASE2_SCREENSHOT),
      type: "jpeg",
      quality: 84,
      fullPage: true,
    });
  await library.getByLabel("De (m)", { exact: true }).fill("2000");
  await library
    .getByRole("heading", { name: expectedWell })
    .waitFor({ state: "hidden" });
  for (let i = 0; i < 5; i++)
    await api("auth/recover", { email: "rate@example.test" });
  const limit = await api("auth/recover", { email: "rate@example.test" });
  assert.equal(limit.status(), 429);
  assert.ok(Number(limit.headers()["retry-after"]) > 0);
  assert.deepEqual(crashes, []);
  console.log(
    "PASS Worker DLIS, erro isolado por arquivo, R2/D1, duplicado 409, revisão, miniatura de amostras, atualização automática para visitante, cinco filtros e limite 429.",
  );
} catch (error) {
  if (tab && !tab.isClosed())
    console.error(
      "Tela:",
      await tab.locator("h1,h2,.notice,summary").allTextContents(),
    );
  console.error(logs.slice(-2000).replace(/password[^\n]*/gi, "[redacted]"));
  throw error;
} finally {
  db?.close();
  await browser?.close();
  if (server && server.exitCode === null) {
    const closed = once(server, "exit");
    server.kill("SIGTERM");
    await closed;
  }
  await rm(temp, { recursive: true, force: true });
}
