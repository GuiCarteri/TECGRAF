// All identities and provider responses in this file are isolated test fixtures.
// The application always validates sessions against the configured provider.
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.resolve("wrangler"));
const { Miniflare } = require("miniflare");
const users = new Map(
  ["reader", "other", "admin"].map((name) => [
    name + "@example.test",
    {
      id: name,
      email: name + "@example.test",
      email_confirmed_at: "2026-01-01",
      user_metadata: { name },
    },
  ]),
);
const tokens = new Map(),
  refreshTokens = new Map();
let providerCalls = 0;
function session(user) {
  const access_token = randomUUID(),
    refresh_token = randomUUID();
  tokens.set(access_token, user);
  refreshTokens.set(refresh_token, user);
  return { access_token, refresh_token, expires_in: 3600, user };
}
async function provider(request) {
  providerCalls++;
  const url = new URL(request.url);
  assert.equal(url.origin, "https://provider.test");
  const body = await request.json().catch(() => ({}));
  const action = url.pathname.replace("/auth/v1/", "");
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (action === "user") {
    const user = tokens.get(token);
    if (!user) return Response.json({ code: "bad_jwt" }, { status: 401 });
    if (request.method === "PUT")
      assert.equal(body.password, "new-password-123");
    return Response.json(user);
  }
  if (action === "logout") {
    tokens.delete(token);
    return Response.json({});
  }
  if (action === "token") {
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const user = refreshTokens.get(body.refresh_token);
      if (!user)
        return Response.json(
          { code: "refresh_token_not_found" },
          { status: 401 },
        );
      refreshTokens.delete(body.refresh_token);
      return Response.json(session(user));
    }
    const user = users.get(body.email);
    if (!user || !["test-password-123", "short1"].includes(body.password))
      return Response.json({ code: "invalid_credentials" }, { status: 400 });
    return Response.json(session(user));
  }
  if (action === "signup") {
    users.set(body.email, {
      id: randomUUID(),
      email: body.email,
      user_metadata: { name: body.data.name },
    });
    return Response.json({});
  }
  if (["recover", "resend"].includes(action)) return Response.json({});
  if (action === "verify") {
    const user = users.get(body.email);
    if (!user || body.token !== "123456")
      return Response.json({ code: "otp_expired" }, { status: 403 });
    user.email_confirmed_at = "2026-01-01";
    return Response.json(session(user));
  }
  throw new Error("Unexpected provider action " + action);
}
function options(configured = true) {
  return {
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
    cf: false,
    bindings: configured
      ? {
          SUPABASE_URL: "https://provider.test",
          SUPABASE_ANON_KEY: "test-only-key",
          ADMIN_USER_IDS: "admin",
        }
      : {},
    outboundService: provider,
  };
}
const mf = new Miniflare(options());
const jars = new Map();
async function call(
  path,
  method = "GET",
  body,
  actor = "anonymous",
  headers = {},
) {
  const jar = jars.get(actor) || new Map();
  jars.set(actor, jar);
  const response = await mf.dispatchFetch("https://strata.test/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://strata.test",
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of response.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (pair.slice(i + 1)) jar.set(pair.slice(0, i), pair.slice(i + 1));
    else jar.delete(pair.slice(0, i));
  }
  return { status: response.status, data: await response.json(), response };
}
try {
  const db = await mf.getD1Database("DB");
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync("drizzle/" + f, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await db.prepare(sql).run();
  assert.equal((await call("files")).status, 200);
  assert.equal((await call("analyses")).status, 401);
  assert.equal(
    (
      await call("analyses", "GET", undefined, "anonymous", {
        "oai-authenticated-user-id": "admin",
        "oai-authenticated-user-email": "admin@example.test",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("auth/login", "POST", {
        email: "reader@example.test",
        password: "wrong-password",
      })
    ).data.error,
    "AUTH_INVALID_CREDENTIALS",
  );
  for (const name of ["reader", "other", "admin"]) {
    const result = await call(
      "auth/login",
      "POST",
      { email: name + "@example.test", password: "test-password-123" },
      name,
    );
    assert.equal(result.status, 200);
    assert.match(result.response.headers.getSetCookie().join(";"), /HttpOnly/i);
    assert.match(result.response.headers.getSetCookie().join(";"), /Secure/i);
  }
  assert.equal(
    (await call("me", "GET", undefined, "reader")).data.user.role,
    "user",
  );
  assert.equal(
    (await call("admin/files", "GET", undefined, "reader")).status,
    403,
  );
  assert.equal(
    (
      await call(
        "uploads",
        "POST",
        { name: "x.dlis", size: 84, hash: "a".repeat(64) },
        "reader",
      )
    ).status,
    403,
  );
  const hash = "a".repeat(64),
    point = {
      fileHash: hash,
      sampleIndex: 0,
      componentIndex: 0,
      channel: "VDL",
      rawValue: 3.5,
    };
  const region = {id:'r',fileHash:hash,track:'[0,"frame","channel"]',depthName:'DEPTH',stride:8,from:100,to:110,first:0,last:7,label:'Revisar',note:'manual'};
  const saved = await call(
    "analyses",
    "POST",
    { hash, name: "Test", fileName: "local.dlis", points: [point], settings:{regions:[region]} },
    "reader",
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.deepEqual((await call('analyses?hash='+hash,'GET',undefined,'reader')).data.analyses[0].settings.regions,[region]);
  assert.equal((await call('analyses','POST',{hash,name:'Invalid',points:[],settings:{regions:[{...region,fileHash:'wrong'}]}},'reader')).status,400);
  assert.equal(
    (await call("analyses?hash=" + hash, "GET", undefined, "reader")).data
      .analyses[0].points[0].rawValue,
    3.5,
  );
  assert.equal(
    (await call("analyses", "GET", undefined, "other")).data.analyses.length,
    0,
  );
  assert.equal(
    (
      await call(
        "analyses",
        "POST",
        { id: saved.data.id, hash, name: "stolen", points: [] },
        "other",
      )
    ).status,
    403,
  );
  await call("analyses/" + saved.data.id, "DELETE", undefined, "other");
  assert.equal(
    (await call("analyses", "GET", undefined, "reader")).data.analyses.length,
    1,
  );
  assert.equal(
    (
      await call(
        "analyses",
        "POST",
        {
          id: saved.data.id,
          hash: "b".repeat(64),
          name: "changed",
          points: [],
        },
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
        { id: "supabase:reader", role: "publisher" },
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
    (
      await call(
        "admin/users",
        "POST",
        { id: "supabase:admin", role: "user" },
        "admin",
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("history", "POST", { hash, fileName: "x.dlis" }, "reader"))
      .status,
    200,
  );
  assert.equal(
    (await call("history", "GET", undefined, "other")).data.history.length,
    0,
  );
  assert.equal(
    (
      await call(
        "exports",
        "POST",
        { hash, format: "json", count: 1 },
        "reader",
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("exports", "GET", undefined, "other")).data.exports.length,
    0,
  );
  const upload = await call(
    "uploads",
    "POST",
    { name: "x.dlis", hash: "b".repeat(64), size: 84 },
    "reader",
  );
  assert.equal(upload.status, 200);
  const invalidHeader = await mf.dispatchFetch("https://strata.test/api/uploads/" + upload.data.id + "/part?n=1", {
    method: "PUT", headers: { Origin: "https://strata.test", Cookie: [...jars.get("reader")].map(([k,v]) => k + "=" + v).join("; ") }, body: new Uint8Array(84),
  });
  assert.equal(invalidHeader.status, 400);
  for (const metadata of [{ version: "V1.00", logicalFiles: [null] }, { version: "V1.00", logicalFiles: [{ frames: [null] }] }]) {
    const invalid = await call("uploads/" + upload.data.id + "/complete", "POST", { authorized: true, confirmed: true, collection: "Test", company: "Test", metadata }, "reader");
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.error, "Confirme os metadados, a empresa e a autorização.");
  }

  assert.equal(
    (await call("uploads/" + upload.data.id, "DELETE", undefined, "other"))
      .status,
    403,
  );
  assert.equal(
    (await call("uploads/" + upload.data.id, "DELETE", undefined, "reader"))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "analyses",
        "POST",
        { hash, name: "CSRF", points: [] },
        "reader",
        { Origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  // Deletion uses synthetic data only; owners and admins can delete, others cannot.
  const storage = await mf.getR2Bucket("BUCKET");
  async function seedPublication(id, status = "validated") {
    await storage.put("dlis/" + id, "synthetic bytes");
    await db.prepare("INSERT INTO files (id,hash,owner_id,publisher,original_name,size,object_key,collection,metadata,status,visibility,authorization,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, id.padEnd(64, "0"), "supabase:reader", "reader", "fixture.dlis", 15, "dlis/" + id, "Tests", "{}", status, "public", 1, "2026-01-01").run();
  }
  await seedPublication("delete-owner");
  await call("history", "POST", { hash, fileName: "fixture.dlis", fileId: "delete-owner" }, "reader");
  assert.equal((await call("files/delete-owner", "DELETE")).status, 401);
  assert.equal((await call("files/delete-owner", "DELETE", undefined, "other")).status, 404);
  assert.equal((await call("files/delete-owner", "DELETE", undefined, "reader", { Origin: "https://evil.test" })).status, 403);
  assert.ok(await storage.head("dlis/delete-owner"));
  assert.ok(await db.prepare("SELECT id FROM files WHERE id='delete-owner'").first());
  assert.equal((await call("files/delete-owner", "DELETE", undefined, "reader")).status, 200);
  assert.equal(await storage.head("dlis/delete-owner"), null);
  assert.equal(await db.prepare("SELECT id FROM files WHERE id='delete-owner'").first(), null);
  assert.equal((await call("history", "GET", undefined, "reader")).data.history[0].file_id, null);
  assert.equal((await call("analyses", "GET", undefined, "reader")).data.analyses.length, 1);
  assert.equal((await call("exports", "GET", undefined, "reader")).data.exports.length, 1);
  assert.equal((await call("files/delete-owner", "GET", undefined, "reader")).status, 404);
  assert.equal((await call("files/delete-owner/content", "GET", undefined, "admin")).status, 404);
  assert.equal((await call("files/delete-owner", "DELETE", undefined, "reader")).status, 404);
  for (const status of ["pending", "review", "archived", "validated"]) {
    const id = "delete-admin-" + status;
    await seedPublication(id, status);
    assert.equal((await call("files/" + id, "DELETE", undefined, "admin")).status, 200);
    assert.equal(await storage.head("dlis/" + id), null);
  }
  // A second completion must never remove bytes registered by the first.
  const duplicateBytes = new Uint8Array(84);
  const duplicateHash = createHash("sha256").update(duplicateBytes).digest("hex");
  const duplicate = await call("uploads", "POST", { name: "race.dlis", size: 84, hash: duplicateHash }, "reader");
  const duplicateId = duplicate.data.id;
  assert.equal(duplicate.status, 200);
  await seedPublication(duplicateId, "pending");
  await storage.put("dlis/" + duplicateId, duplicateBytes);
  const completed = await call("uploads/" + duplicateId + "/complete", "POST", {
    authorized: true, confirmed: true, collection: "Test", company: "Test",
    metadata: { version: "V1.00", logicalFiles: [] }, parts: [{ partNumber: 1, etag: "fixture" }],
  }, "reader");
  assert.equal(completed.status, 409);
  assert.ok(await storage.head("dlis/" + duplicateId));
  assert.ok(await db.prepare("SELECT id FROM files WHERE id=?").bind(duplicateId).first());
  // Simulate interruption between hiding the publication and storage cleanup.
  await seedPublication("delete-retry", "deleting");
  assert.ok(!(await call("files")).data.files.some(f => f.id === "delete-retry"));
  assert.equal((await call("files/delete-retry/content", "GET", undefined, "admin")).status, 404);
  await call("admin/files", "POST", { id: "delete-retry", status: "validated", reviewed: true, note: "review" }, "admin");
  assert.equal((await db.prepare("SELECT status FROM files WHERE id='delete-retry'").first()).status, "deleting");
  await storage.delete("dlis/delete-retry");
  assert.equal((await call("files/delete-retry", "DELETE", undefined, "reader")).status, 200);
  for (const invalid of [null, [], "text", 123])
    assert.equal((await call("analyses", "POST", invalid, "reader")).status, 400);
  console.log("PASS: publication deletion permissions, CSRF, R2 cleanup, history, preservation and retry; invalid JSON bodies");
  const native = await mf.dispatchFetch("https://strata.test/api/auth/login", {
    redirect: "manual",
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://strata.test" },
    body: new URLSearchParams({ email: "reader@example.test", password: "short1", next: "/account?tab=files" }).toString(),
  });
  assert.equal(native.status,303);
  assert.equal(native.headers.get("location"),"/account?tab=files");
  const nativeCookies=native.headers.getSetCookie();
  assert.ok(nativeCookies.some(c=>c.startsWith("strata_access=")&&c.includes("HttpOnly")&&c.includes("Secure")));
  const nativeMe=await mf.dispatchFetch("https://strata.test/api/me",{headers:{Cookie:nativeCookies.map(c=>c.split(";")[0]).join("; ")}});
  assert.equal((await nativeMe.json()).user.id,"supabase:reader");
  const invalidNative=await mf.dispatchFetch("https://strata.test/api/auth/login",{
    redirect: "manual",
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Origin:"https://strata.test"},
    body:new URLSearchParams({email:"reader@example.test",password:"wrong",next:"//evil.test"}).toString(),
  });
  assert.equal(invalidNative.status,303);
  assert.equal(invalidNative.headers.get("location"),"/login?error=AUTH_INVALID_CREDENTIALS&next=%2Faccount");
  assert.equal(invalidNative.headers.getSetCookie().length,0);
  const crossOrigin=await mf.dispatchFetch("https://strata.test/api/auth/login",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Origin:"https://evil.test"},body:"email=reader%40example.test&password=short1",
  });
  assert.equal(crossOrigin.status,403);
  console.log("PASS: native login without JS, existing short password, session cookies, safe redirects and CSRF");
  const oldAccess = jars.get("reader").get("strata_access");
  tokens.delete(oldAccess);
  assert.equal(
    (await call("analyses", "GET", undefined, "reader")).status,
    401,
  );
  assert.equal(
    (await call("auth/refresh", "POST", undefined, "reader")).status,
    200,
  );
  assert.notEqual(jars.get("reader").get("strata_access"), oldAccess);
  assert.equal(
    (await call("analyses", "GET", undefined, "reader")).status,
    200,
  );
  jars.get("reader").set("strata_refresh", "expired");
  assert.equal(
    (await call("auth/refresh", "POST", undefined, "reader")).status,
    401,
  );
  assert.equal(jars.get("reader").size, 0);
  assert.equal(
    (
      await call(
        "auth/register",
        "POST",
        {
          email: "new@example.test",
          password: "test-password-123",
          name: "New",
        },
        "new",
      )
    ).data.verify,
    true,
  );
  assert.equal(
    (await call("auth/resend", "POST", { email: "new@example.test" }, "new"))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "auth/verify",
        "POST",
        { email: "new@example.test", token: "000000", type: "signup" },
        "new",
      )
    ).data.error,
    "AUTH_INVALID_CODE",
  );
  assert.equal(
    (
      await call(
        "auth/verify",
        "POST",
        { email: "new@example.test", token: "123456", type: "signup" },
        "new",
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("auth/recover", "POST", { email: "new@example.test" }, "new"))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        "auth/verify",
        "POST",
        { email: "new@example.test", token: "123456", type: "recovery" },
        "new",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "auth/change-password",
        "POST",
        { email: "other@example.test", password: "new-password-123" },
        "new",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "auth/change-password",
        "POST",
        { email: "new@example.test", password: "new-password-123" },
        "new",
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("auth/logout", "POST", undefined, "new")).status,
    200,
  );
  assert.equal((await call("analyses", "GET", undefined, "new")).status, 401);
  console.log(
    "PASS: login, confirmation, resend, recovery, reset, refresh, expiry, logout, cookie flags, header spoofing rejection, CSRF, roles, D1 account isolation, R2 upload boundaries. Provider mocked only in test runner (" +
      providerCalls +
      " requests).",
  );
  const missing = new Miniflare(options(false));
  try {
    const res = await missing.dispatchFetch(
      "https://strata.test/api/auth/login",
      { method: "POST", body: "{}" },
    );
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, "AUTH_NOT_CONFIGURED");
  } finally {
    await missing.dispose();
  }
  console.log("PASS: missing configuration fails closed.");
} finally {
  await mf.dispose();
}
