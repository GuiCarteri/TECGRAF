import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { makeFixture } from "../tests/fixtures/dlis.mjs";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import {
  defaultDepthChannel,
  extractMetadata,
  numericRange,
  sha256,
} from "../lib/dlis/core.js";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
// O catálogo de exemplo usa apenas dados fictícios e os mesmos bindings locais do Vite.
export async function seedDatabase({ DB, BUCKET }) {
  for (const [name, rows] of [
    ["Aurora", 121],
    ["Boreal", 251],
  ]) {
    const wellName = `Poço sintético ${name}`;
    const bytes = makeFixture({ rows, wellName });
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const hash = await sha256(buffer);
    const key = `seed/${hash}.dlis`;
    const existing = await DB.prepare(
      "SELECT object_key FROM files WHERE hash = ?",
    )
      .bind(hash)
      .first();
    if (existing && existing.object_key !== key) {
      console.log(`${wellName} já existe no catálogo local.`);
      continue;
    }
    const parsed = DLISFile.fromBuffer(buffer);
    const metadata = { ...extractMetadata(parsed), hash };
    const frame = metadata.logicalFiles[0].frames[0];
    const depth = defaultDepthChannel(frame);
    const decoded = parsed.logicalFiles[0].frames.get(frame.key).decode();
    const limits = numericRange(decoded.data[depth]);
    const depthLabel = `${limits[0].toFixed(1)}–${limits[1].toFixed(1)} m`;
    metadata.validation = [
      {
        lf: 0,
        frame: frame.key,
        samples: decoded.frameCount,
        depthRangeMeters: limits,
        ok: true,
      },
    ];
    const types = [
      ...new Set(
        frame.channels
          .map((channel) => channel.kind)
          .filter((kind) => ["CBL", "VDL", "USIT", "GR"].includes(kind)),
      ),
    ];
    // A inserção só ocorre depois que os bytes estão disponíveis. Repetir repara um objeto ausente.
    await BUCKET.put(key, bytes);
    const timestamp = new Date().toISOString();
    await DB.prepare(
      `INSERT INTO files (id, hash, owner_id, publisher, original_name, size, object_key, well, company, collection,
        types, depth_label, metadata, status, visibility, authorization, created_at, published_at)
       VALUES (?, ?, 'local-seed', 'STRATA', ?, ?, ?, ?, 'Test only', 'Exemplos sintéticos',
        ?, ?, ?, 'validated', 'public', 1, ?, ?) ON CONFLICT(hash) DO NOTHING`,
    )
      .bind(
        `seed-${hash}`,
        hash,
        `synthetic-${name.toLowerCase()}.dlis`,
        bytes.length,
        key,
        wellName,
        JSON.stringify(types),
        depthLabel,
        JSON.stringify(metadata),
        timestamp,
        timestamp,
      )
      .run();
    console.log(
      `OK  ${wellName} · ${decoded.frameCount} amostras · ${depthLabel}`,
    );
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.chdir(root);
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  const migration = spawnSync(
    process.execPath,
    [
      require.resolve("wrangler/bin/wrangler.js"),
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (migration.error) throw migration.error;
  if (migration.status !== 0) process.exit(migration.status ?? 1);

  const platform = await getPlatformProxy({ configPath: "wrangler.json" });
  try {
    await seedDatabase(platform.env);
  } finally {
    await platform.dispose();
  }
}
