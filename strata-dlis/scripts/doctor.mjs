import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as util from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const [major, minor] = process.versions.node.split(".").map(Number);
const compatible = major > 22 || (major === 22 && minor >= 18);
function report(ok, text, fix) {
  console.log(`${ok ? "OK" : "ERRO"}  ${text}`);
  if (!ok) {
    process.exitCode = 1;
    console.log(`      ${fix}`);
  }
}
report(
  compatible,
  `Node ${process.versions.node} (mínimo 22.18).`,
  "Instale o Node 24 LTS e abra um terminal novo.",
);

const npmVersion = spawnSync("npm", ["--version"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
report(
  npmVersion.status === 0,
  `npm ${npmVersion.stdout?.trim() || "indisponível"}.`,
  "Instale a distribuição do Node que inclui npm.",
);
console.log(`INFO  A instalação usa ${manifest.packageManager} pelo npm.`);
const installed = ["vite", "wrangler", "typescript"].every((name) =>
  existsSync(join(root, "node_modules", name, "package.json")),
);
console.log(
  installed
    ? "OK  Dependências locais instaladas."
    : "INFO  O primeiro npm run dev instala as dependências do lockfile.",
);

const port = 5173;
const host = process.env.CODESPACES === "true" ? "0.0.0.0" : "127.0.0.1";
await new Promise((resolve) => {
  const server = createServer();
  server.once("error", (error) => {
    report(
      false,
      `Porta ${port} indisponível (${error.code}).`,
      "Se o STRATA já estiver aberto, use essa instância. Para liberar a porta, encerre o servidor com Ctrl+C.",
    );
    resolve();
  });
  server.listen(port, host, () =>
    server.close(() => {
      report(true, `Porta ${port} livre.`);
      resolve();
    }),
  );
});

if (compatible) {
  const { authConfig } = await import("../lib/auth-input.ts");
  const name = join(root, ".dev.vars");
  const vars = {
    ...process.env,
    ...(existsSync(name) ? util.parseEnv(readFileSync(name, "utf8")) : {}),
  };
  if (vars.SUPABASE_URL || vars.SUPABASE_ANON_KEY) {
    report(
      authConfig(vars.SUPABASE_URL, vars.SUPABASE_ANON_KEY).configured,
      "Verificação do formato das variáveis Supabase.",
      "Em strata-dlis/.dev.vars, preencha SUPABASE_URL com a URL HTTPS do projeto e SUPABASE_ANON_KEY com a chave pública. Reinicie o site.",
    );
  } else {
    console.log(
      "INFO  Modo público local. Para habilitar contas, configure SUPABASE_URL e SUPABASE_ANON_KEY em strata-dlis/.dev.vars.",
    );
  }
}
