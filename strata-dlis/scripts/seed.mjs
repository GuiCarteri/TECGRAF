import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { makeFixture } from "../tests/fixtures/dlis.mjs";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import {
  sha256,
  validateHeader,
  catalogTypes,
  catalogDepthLabel,
} from "../lib/dlis/core.js";
import { inspectFrames } from "../lib/dlis/inspect.js";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
async function sampleFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sampleFiles(path)));
    else if (entry.isFile() && /\.dlis$/i.test(entry.name)) files.push(path);
  }
  return files.sort();
}
export async function seedDatabase(
  { DB, BUCKET },
  directories = [resolve(root, "samples"), resolve(root, "../samples")],
) {
  const sources = (await Promise.all(directories.map(sampleFiles)))
    .flat()
    .map((path) => ({ name: basename(path), path }));
  if (!sources.length) {
    for (const [well, rows] of [
      ["Aurora", 121],
      ["Boreal", 251],
    ])
      sources.push({
        name: "synthetic-" + well.toLowerCase() + ".dlis",
        well: "Poço sintético " + well,
        rows,
      });
  }
  const failures = [];
  for (const source of sources) {
    try {
      let bytes;
      if (source.path) bytes = await readFile(source.path);
      else {
        const previous = await DB.prepare(
          "SELECT hash FROM files WHERE owner_id='local-seed' AND original_name=?",
        )
          .bind(source.name)
          .first();
        const options = { rows: source.rows, wellName: source.well };
        // Conserva o hash e os vínculos dos exemplos já instalados na fase 1.
        if (previous) {
          const legacy = makeFixture(options);
          if ((await sha256(legacy)) === previous.hash) bytes = legacy;
        }
        bytes ??= makeFixture({ ...options, catalogDetails: true });
      }
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      validateHeader(buffer);
      const hash = await sha256(buffer),
        key = "seed/" + hash + ".dlis";
      const existing = await DB.prepare(
        "SELECT object_key,owner_id FROM files WHERE hash=?",
      )
        .bind(hash)
        .first();
      if (
        existing &&
        (existing.object_key !== key || existing.owner_id !== "local-seed")
      ) {
        console.log(source.name + " já existe no catálogo local.");
        continue;
      }
      const metadata = { ...inspectFrames(DLISFile.fromBuffer(buffer)), hash };
      const origins = metadata.logicalFiles.flatMap((l) => l.origins || []);
      const unique = (k) => {
        const values = [...new Set(origins.map((o) => o[k]).filter(Boolean))];
        return values.length === 1 ? String(values[0]) : null;
      };
      const depthLabel = catalogDepthLabel(metadata.validation, 1) || null;
      const types = catalogTypes(metadata.logicalFiles);
      await BUCKET.put(key, bytes);
      const timestamp = new Date().toISOString();
      await DB.prepare(
        `INSERT INTO files(id,hash,owner_id,publisher,original_name,size,object_key,well,field,company,collection,types,depth_label,metadata,status,visibility,authorization,created_at,published_at)
        VALUES(?,?,'local-seed','STRATA',?,?,?,?,?,?,?,?,?,?,'validated','public',1,?,?)
        ON CONFLICT(hash) DO UPDATE SET metadata=excluded.metadata, depth_label=excluded.depth_label WHERE files.owner_id='local-seed' AND files.object_key=excluded.object_key AND files.metadata<>excluded.metadata`,
      )
        .bind(
          "seed-" + hash,
          hash,
          source.name,
          bytes.byteLength,
          key,
          unique("wellName"),
          unique("fieldName"),
          unique("company"),
          source.path ? "Amostras locais" : "Exemplos sintéticos",
          JSON.stringify(types),
          depthLabel,
          JSON.stringify(metadata),
          timestamp,
          timestamp,
        )
        .run();
      console.log(
        "OK  " +
          source.name +
          " · " +
          metadata.validation.reduce((n, v) => n + (v.samples || 0), 0) +
          " amostras · " +
          (depthLabel || "profundidade não declarada"),
      );
    } catch (error) {
      failures.push(source.name + " · " + error.message);
    }
  }
  if (failures.length) throw Error(failures.join("\n"));
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

  const platform = await getPlatformProxy({
    configPath: "wrangler.json",
    remoteBindings: false,
  });
  try {
    await seedDatabase(platform.env);
  } finally {
    await platform.dispose();
  }
}
