import { readFileSync } from "node:fs";
const source = JSON.parse(readFileSync("wrangler.json", "utf8"));
const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
for (const config of [source, built]) {
  if (!config.d1_databases?.[0]?.database_id || config.d1_databases[0].database_id.startsWith("00000000"))
    throw new Error("Set your D1 database ID in wrangler.json and rebuild before deployment.");
}
if (source.d1_databases[0].database_id !== built.d1_databases[0].database_id)
  throw new Error("Configuration changed. Run pnpm build again.");
