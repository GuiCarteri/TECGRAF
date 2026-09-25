// Generate a normal Wrangler configuration for deployment without Sites tools.
import { readFileSync, writeFileSync } from "node:fs";
const [name, databaseId, bucketName] = process.argv.slice(2);
if (!name || !databaseId || !bucketName)
  throw new Error(
    "Usage: node scripts/deploy-config.mjs <worker-name> <d1-database-id> <r2-bucket-name>",
  );
const config = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
config.name = name;
delete config.topLevelName;
config.d1_databases = [
  {
    binding: "DB",
    database_name: name + "-db",
    database_id: databaseId,
    migrations_dir: "../../drizzle",
  },
];
config.r2_buckets = [{ binding: "BUCKET", bucket_name: bucketName }];
config.vars = { AUTH_MODE: "supabase" };
writeFileSync(
  "dist/server/wrangler.standalone.json",
  JSON.stringify(config, null, 2),
);
console.log(
  "Created dist/server/wrangler.standalone.json. Set secrets before deploying.",
);
