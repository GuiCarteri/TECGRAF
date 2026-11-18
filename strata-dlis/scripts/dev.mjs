// Runs only when explicitly invoked with pnpm dev. Never writes credentials.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
let child;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
async function run(args) {
  child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      CLOUDFLARE_CF_FETCH_ENABLED:
        process.env.CLOUDFLARE_CF_FETCH_ENABLED ?? "false",
    },
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(signal ? 130 : (code ?? 1)));
  });
}
try {
  console.log(
    "STRATA: preparando somente o banco local. Credenciais existentes serão preservadas.",
  );
  const code = await run([
    require.resolve("wrangler/bin/wrangler.js"),
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
  ]);
  if (code || stopping) process.exitCode = code || 130;
  else
    process.exitCode = await run([
      fileURLToPath(
        new URL("../node_modules/vite/bin/vite.js", import.meta.url),
      ),
      ...process.argv.slice(2),
    ]);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha ao iniciar STRATA.",
  );
  process.exitCode = 1;
}
