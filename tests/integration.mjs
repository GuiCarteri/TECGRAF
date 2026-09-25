// Isolated local Worker/D1/R2 test. Never sends requests to a production Site.
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { extractMetadata } from "../lib/dlis/core.js";
import assert from "node:assert/strict";
const require = createRequire(import.meta.resolve("wrangler"));
const { Miniflare } = require("miniflare");
const mf = new Miniflare({
  modules: [
    { type: "ESModule", path: resolve("dist/server/index.js") },
    ...readdirSync("dist/server", { recursive: true })
      .filter((x) => String(x).endsWith(".js") && x !== "index.js")
      .map((x) => ({ type: "ESModule", path: resolve("dist/server", x) })),
  ],
  modulesRoot: resolve("dist/server"),
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  bindings: { ADMIN_EMAILS: "admin@example.test" },
  cf: false,
});
try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync("drizzle/" + file, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await db.prepare(sql).run();
  async function call(path, method = "GET", body, user) {
    const headers = { "Content-Type": "application/json" };
    if (user) {
      headers["oai-authenticated-user-id"] = user;
      headers["oai-authenticated-user-email"] = user + "@example.test";
    }
    const res = await mf.dispatchFetch("https://strata.test/api/" + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }
  assert.equal((await call("files")).status, 200);
  assert.equal((await call("analyses")).status, 401);
  assert.equal(
    (await call("me", "GET", undefined, "reader")).data.user.role,
    "user",
  );
  assert.equal(
    (await call("admin/files", "GET", undefined, "reader")).status,
    403,
  );
  const hash = "a".repeat(64);
  const saved = await call(
    "analyses",
    "POST",
    {
      hash,
      fileName: "local.DLIS",
      name: "Test",
      points: [
        {
          fileHash: hash,
          sampleIndex: 0,
          componentIndex: 0,
          channel: "VDL",
          rawValue: 3.5,
        },
      ],
    },
    "reader",
  );
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const aid = saved.data.id;
  assert.equal(
    (await call("analyses?hash=" + hash, "GET", undefined, "reader")).data
      .analyses[0].points[0].rawValue,
    3.5,
  );
  assert.equal(
    (await call("analyses?hash=" + hash, "GET", undefined, "other")).data
      .analyses.length,
    0,
  );
  assert.equal(
    (
      await call(
        "analyses",
        "POST",
        { id: aid, hash, fileName: "x", name: "Test", points: [] },
        "other",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "uploads",
        "POST",
        { name: "x.DLIS", hash, size: 84 },
        "reader",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("me", "GET", undefined, "admin")).data.user.role,
    "admin",
  );
  assert.equal(
    (
      await call(
        "admin/users",
        "POST",
        { id: "reader", role: "publisher" },
        "admin",
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("me", "GET", undefined, "reader")).data.user.role,
    "publisher",
  );
  assert.equal(
    (await call("history", "POST", { hash, fileName: "x.DLIS" }, "reader"))
      .status,
    200,
  );
  assert.equal(
    (await call("history", "GET", undefined, "reader")).data.history.length,
    1,
  );
  assert.equal(
    (await call("history", "GET", undefined, "other")).data.history.length,
    0,
  );
  console.log(
    "PASS: Worker auth boundaries, account isolation, persistence, history, roles.",
  );
  if (process.argv[2]) {
    const bytes = readFileSync(process.argv[2]);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const metadata = extractMetadata(DLISFile.fromBuffer(buffer));
    const init = await call(
      "uploads",
      "POST",
      { name: basename(process.argv[2]), hash: fileHash, size: bytes.length },
      "reader",
    );
    assert.equal(init.status, 200, JSON.stringify(init));
    const id = init.data.id,
      parts = [];
    for (
      let start = 0, n = 1;
      start < bytes.length;
      start += 8 * 1024 * 1024, n++
    ) {
      const response = await mf.dispatchFetch(
        "https://strata.test/api/uploads/" + id + "/part?n=" + n,
        {
          method: "PUT",
          headers: {
            "oai-authenticated-user-id": "reader",
            "oai-authenticated-user-email": "reader@example.test",
          },
          body: bytes.subarray(
            start,
            Math.min(start + 8 * 1024 * 1024, bytes.length),
          ),
        },
      );
      const part = await response.json();
      assert.equal(response.status, 200, JSON.stringify(part));
      parts.push(part);
    }
    const origin = metadata.logicalFiles[0]?.origin || {};
    const payload = {
      parts,
      metadata,
      company: origin.company || "Empresa não informada",
      collection: origin.field || "Teste local",
      well: origin.well,
      authorized: true,
      confirmed: true,
      visibility: "public",
    };
    assert.equal(
      (
        await call(
          "uploads/" + id + "/complete",
          "POST",
          { ...payload, authorized: false },
          "reader",
        )
      ).status,
      400,
    );
    const finished = await call(
      "uploads/" + id + "/complete",
      "POST",
      payload,
      "reader",
    );
    assert.equal(finished.status, 200, JSON.stringify(finished));
    assert.ok(["pending", "review"].includes(finished.data.status));
    assert.equal((await call("files")).data.files.length, 0);
    assert.equal(
      (await call("files/" + id, "GET", undefined, "other")).status,
      404,
    );
    assert.equal(
      (
        await call(
          "admin/files",
          "POST",
          {
            id,
            status: "validated",
            reviewed: true,
            note: "Revisão em teste isolado",
          },
          "admin",
        )
      ).status,
      200,
    );
    assert.equal((await call("files")).data.files[0].id, id);
    assert.equal((await call("files/" + id + "/content")).status, 401);
    const download = await mf.dispatchFetch(
      "https://strata.test/api/files/" + id + "/content",
      {
        headers: {
          "oai-authenticated-user-id": "other",
          "oai-authenticated-user-email": "other@example.test",
        },
      },
    );
    assert.equal(download.status, 200);
    assert.equal(
      createHash("sha256")
        .update(new Uint8Array(await download.arrayBuffer()))
        .digest("hex"),
      fileHash,
    );
    assert.equal(
      (
        await call(
          "uploads",
          "POST",
          {
            name: basename(process.argv[2]),
            hash: fileHash,
            size: bytes.length,
          },
          "reader",
        )
      ).status,
      409,
    );
    assert.equal(
      (await call("admin/files", "POST", { id, status: "archived" }, "admin"))
        .status,
      200,
    );
    assert.equal((await call("files")).data.files.length, 0);
    console.log(
      "PASS: real DLIS multipart upload, authorization requirement, pending review, approval, protected download, exact SHA-256, duplicate rejection, archive.",
    );
  }
} finally {
  await mf.dispose();
}
