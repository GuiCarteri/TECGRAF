import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture } from "./fixtures/dlis.mjs";
import { seedDatabase } from "../scripts/seed.mjs";
import { sha256 } from "../lib/dlis/core.js";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";

const require = createRequire(import.meta.resolve("wrangler"));
const { Miniflare } = require("miniflare");
const runtime = new Miniflare({
  modules: true,
  script: "export default {fetch(){return new Response()}}",
  compatibilityDate: "2026-05-15",
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
});
try {
  const DB = await runtime.getD1Database("DB");
  const BUCKET = await runtime.getR2Bucket("BUCKET");
  for (const file of (await readdir("drizzle"))
    .filter((path) => path.endsWith(".sql"))
    .sort()) {
    const sql = await readFile("drizzle/" + file, "utf8");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await DB.prepare(statement).run();
    }
  }
  const rows = () =>
    DB.prepare("SELECT * FROM files ORDER BY id")
      .all()
      .then((response) => response.results);
  await seedDatabase({ DB, BUCKET }, []);
  const first = await rows();
  assert.equal(first.length, 2);
  await seedDatabase({ DB, BUCKET }, []);
  assert.deepEqual(await rows(), first);
  assert.equal(
    (await DB.prepare("SELECT COUNT(*) AS n FROM file_wells").first()).n,
    2,
  );
  for (const file of first) {
    assert.match(file.well, /sintético/);
    assert.equal(file.status, "validated");
    assert.equal(file.visibility, "public");
    const bytes = await (await BUCKET.get(file.object_key)).arrayBuffer();
    assert.equal(await sha256(bytes), file.hash);
    const parsed = DLISFile.fromBuffer(bytes);
    const frame = parsed.logicalFiles[0].frames.values().next().value;
    assert.equal(parsed.logicalFiles[0].origin.wellName, file.well);
    assert.equal(
      frame.decode().frameCount,
      JSON.parse(file.metadata).validation[0].samples,
    );
  }
  const samples = await mkdtemp(join(tmpdir(), "strata-samples-"));
  try {
    await writeFile(
      join(samples, "sample.DLIS"),
      makeFixture({ wellName: "Sample import", rows: 9, catalogDetails: true }),
    );
    await writeFile(join(samples, "broken.dlis"), Buffer.alloc(100));
    await assert.rejects(
      seedDatabase({ DB, BUCKET }, [samples]),
      /broken.dlis/,
    );
    const imported = (await rows()).find((f) => f.well === "Sample import");
    assert.equal(imported.collection, "Amostras locais");
    assert.equal((await rows()).length, 3);
    const summary = JSON.parse(
      (
        await DB.prepare("SELECT summary FROM catalog_index WHERE file_id=?")
          .bind(imported.id)
          .first()
      ).summary,
    );
    assert.equal(summary.samples, 9);
    assert.ok(summary.tools.includes("QA-GR"));
    await rm(join(samples, "broken.dlis"));
    await seedDatabase({ DB, BUCKET }, [samples]);
    assert.equal((await rows()).length, 3);
    console.log(
      "PASS samples/ preferencial, extensão maiúscula, falha por arquivo, índice e repetição sem duplicatas.",
    );
  } finally {
    await rm(samples, { recursive: true, force: true });
  }
  console.log(
    "PASS: two synthetic DLIS, public metadata, matching R2 bytes/SHA-256, real frames and idempotent D1/well links.",
  );
} finally {
  await runtime.dispose();
}
