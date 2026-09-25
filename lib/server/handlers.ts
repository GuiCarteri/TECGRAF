import { authHandler } from "./auth-handlers";
import { authMode } from "./provider";
import { query, bucket, database } from "./db";
import { HttpError, currentUser, requireUser, sameOrigin } from "./auth";
import { mayRead, companyMatches, validateHeader } from "../dlis/core.js";
import { sha256 } from "@noble/hashes/sha2.js";
const now = () => new Date().toISOString(),
  uuid = () => crypto.randomUUID();
const str = (x: any, max = 400) =>
  typeof x === "string" ? x.trim().slice(0, max) : "";
const hashOk = (h: any) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h);
const json = (data: any, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const parseFile = (f: any) => ({
  ...f,
  types: JSON.parse(f.types || "[]"),
  metadata: f.metadata ? JSON.parse(f.metadata) : undefined,
});
async function body(req: Request, limit = 5_000_000) {
  const text = await req.text();
  if (text.length > limit)
    throw new HttpError("Conteúdo excede o limite permitido.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError("Dados inválidos.");
  }
}
async function fileById(id: string, user: any) {
  const f = await query("SELECT * FROM files WHERE id=?", id).first<any>();
  if (!f || !mayRead(f, user))
    throw new HttpError("Arquivo não encontrado ou sem permissão.", 404);
  return f;
}
export async function handle(request: Request, path: string[]) {
  try {
    if (request.method !== "GET") sameOrigin(request);
    const [route, id, action] = path,
      url = new URL(request.url);
    if (route === "auth") return authHandler(request, id);
    if (route === "me" && request.method === "GET")
      return json({ user: await currentUser(), authMode: authMode() });
    if (route === "files" && request.method === "GET" && !id) {
      const r = await query(
        "SELECT id,well,field,company,collection,run,location,types,depth_label,size,publisher,published_at,status,original_name FROM files WHERE status='validated' AND visibility='public' ORDER BY collection,published_at DESC",
      ).all();
      return json({ files: r.results.map(parseFile) });
    }
    if (route === "files" && id && request.method === "GET") {
      const user = await requireUser();
      const f = await fileById(id, user);
      if (action === "content") {
        const o = await bucket().get(f.object_key);
        if (!o) throw new HttpError("Arquivo indisponível.", 404);
        return new Response(o.body, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(o.size),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition":
              "attachment; filename*=UTF-8''" +
              encodeURIComponent(f.original_name),
          },
        });
      }
      return json({ file: parseFile(f) });
    }
    if (route === "uploads" && request.method === "POST" && !id) {
      const user = await requireUser(["publisher", "admin"]),
        b = await body(request);
      if (
        !/\.dlis$/i.test(b.name) ||
        !hashOk(b.hash) ||
        !Number.isInteger(b.size) ||
        b.size < 84 ||
        b.size > 512 * 1024 * 1024
      )
        throw new HttpError("Envie um DLIS de até 512 MB.");
      if (await query("SELECT id FROM files WHERE hash=?", b.hash).first())
        throw new HttpError(
          "Este arquivo já foi enviado (SHA-256 idêntico).",
          409,
        );
      const uid = uuid(),
        key = "dlis/" + uid;
      const upload = await bucket().createMultipartUpload(key, {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      await query(
        "INSERT INTO uploads (id,owner_id,object_key,upload_id,name,size,hash,created_at) VALUES (?,?,?,?,?,?,?,?)",
        uid,
        user.id,
        key,
        upload.uploadId,
        str(b.name),
        b.size,
        b.hash,
        now(),
      ).run();
      return json({ id: uid });
    }
    if (route === "uploads" && id) {
      const user = await requireUser(["publisher", "admin"]);
      const row = await query(
        "SELECT * FROM uploads WHERE id=? AND owner_id=?",
        id,
        user.id,
      ).first<any>();
      if (!row) throw new HttpError("Envio não encontrado.", 404);
      const upload = bucket().resumeMultipartUpload(
        row.object_key,
        row.upload_id,
      );
      if (request.method === "DELETE") {
        await upload.abort().catch(() => {});
        await query("DELETE FROM uploads WHERE id=?", id).run();
        return json({ ok: true });
      }
      if (request.method === "PUT" && action === "part") {
        const n = Number(url.searchParams.get("n"));
        if (!Number.isInteger(n) || n < 1 || n > 64)
          throw new HttpError("Parte inválida.");
        const bytes = await request.arrayBuffer();
        const expected = Math.min(
          8 * 1024 * 1024,
          row.size - (n - 1) * 8 * 1024 * 1024,
        );
        if (bytes.byteLength !== expected || expected <= 0)
          throw new HttpError("Tamanho da parte inválido.");
        if (n === 1) validateHeader(bytes);
        return json(await upload.uploadPart(n, bytes));
      }
      if (request.method === "POST" && action === "complete") {
        const b = await body(request),
          m = b.metadata;
        if (
          !b.authorized ||
          !b.confirmed ||
          !m ||
          m.version !== "V1.00" ||
          !Array.isArray(m.logicalFiles) ||
          !str(b.collection) ||
          !str(b.company)
        )
          throw new HttpError(
            "Confirme os metadados, a empresa e a autorização.",
          );
        if (
          !Array.isArray(b.parts) ||
          b.parts.length !== Math.ceil(row.size / (8 * 1024 * 1024))
        )
          throw new HttpError("Envio incompleto.");
        const alreadyStored = await bucket().head(row.object_key);
        const object = alreadyStored || (await upload.complete(b.parts));
        const downloaded = await bucket().get(row.object_key);
        if (!downloaded || object.size !== row.size)
          throw new HttpError("Arquivo incompleto.");
        const digest = sha256.create();
        const reader = downloaded.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          digest.update(value);
        }
        const actual = Array.from(digest.digest())
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
        if (actual !== row.hash) {
          await bucket().delete(row.object_key);
          await query("DELETE FROM uploads WHERE id=?", id).run();
          throw new HttpError("SHA-256 divergente: o arquivo não foi aceito.");
        }
        const origins = m.logicalFiles
          .map((lf: any) => lf.origin?.company)
          .filter(Boolean);
        const match =
          origins.length > 0 &&
          origins.every((c: string) => companyMatches(c, b.company));
        const status = match && !m.warnings?.length ? "pending" : "review";
        const types = [
          ...new Set(
            m.logicalFiles
              .flatMap((lf: any) =>
                lf.frames.flatMap((f: any) =>
                  f.channels.map((c: any) => c.kind),
                ),
              )
              .filter((t: any) => ["CBL", "VDL", "USIT", "GR"].includes(t)),
          ),
        ];
        try {
          await query(
            "INSERT INTO files (id,hash,owner_id,publisher,original_name,size,object_key,well,field,company,collection,run,location,types,depth_label,metadata,status,visibility,authorization,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id,
            actual,
            user.id,
            user.name,
            row.name,
            row.size,
            row.object_key,
            str(b.well),
            str(b.field),
            str(b.company),
            str(b.collection),
            str(b.run),
            ["onshore", "offshore"].includes(b.location)
              ? b.location
              : "unknown",
            JSON.stringify(types),
            str(b.depthLabel),
            JSON.stringify(m),
            status,
            ["private", "unlisted"].includes(b.visibility)
              ? b.visibility
              : "public",
            1,
            now(),
          ).run();
        } catch (e) {
          await bucket().delete(row.object_key);
          throw new HttpError(
            "Arquivo duplicado ou publicação não pôde ser registrada.",
            409,
          );
        }
        await query("DELETE FROM uploads WHERE id=?", id).run();
        return json({ id, status });
      }
    }
    if (route === "analyses") {
      const user = await requireUser();
      if (request.method === "GET") {
        const hash = url.searchParams.get("hash");
        const r = hash
          ? await query(
              "SELECT * FROM analyses WHERE owner_id=? AND hash=? ORDER BY updated_at DESC",
              user.id,
              hash,
            ).all()
          : await query(
              "SELECT id,hash,file_name,name,updated_at FROM analyses WHERE owner_id=? ORDER BY updated_at DESC LIMIT 200",
              user.id,
            ).all();
        return json({
          analyses: r.results.map((a: any) => ({
            ...a,
            points: a.points ? JSON.parse(a.points) : undefined,
            settings: a.settings ? JSON.parse(a.settings) : undefined,
          })),
        });
      }
      if (request.method === "POST") {
        const b = await body(request);
        if (
          !hashOk(b.hash) ||
          !Array.isArray(b.points) ||
          b.points.length > 5000 ||
          !str(b.name)
        )
          throw new HttpError("Análise inválida ou mais de 5.000 pontos.");
        for (const p of b.points) {
          if (
            p.fileHash !== b.hash ||
            !Number.isInteger(p.sampleIndex) ||
            p.sampleIndex < 0 ||
            !Number.isInteger(p.componentIndex) ||
            p.componentIndex < 0 ||
            typeof p.channel !== "string" ||
            !(typeof p.rawValue === "number" || p.rawValue === null)
          )
            throw new HttpError("Ponto sem referência válida ao array.");
        }
        const aid = str(b.id) || uuid();
        const existing = await query(
          "SELECT owner_id FROM analyses WHERE id=?",
          aid,
        ).first<any>();
        if (existing && existing.owner_id !== user.id)
          throw new HttpError("Sem permissão.", 403);
        await query(
          "INSERT INTO analyses (id,owner_id,hash,file_name,name,points,settings,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,points=excluded.points,settings=excluded.settings,updated_at=excluded.updated_at",
          aid,
          user.id,
          b.hash,
          str(b.fileName),
          str(b.name),
          JSON.stringify(b.points),
          JSON.stringify(b.settings || {}),
          now(),
        ).run();
        return json({ id: aid });
      }
      if (request.method === "DELETE" && id) {
        await query(
          "DELETE FROM analyses WHERE id=? AND owner_id=?",
          id,
          user.id,
        ).run();
        return json({ ok: true });
      }
    }
    if (route === "history") {
      const user = await requireUser();
      if (request.method === "GET") {
        const r = await query(
          "SELECT * FROM history WHERE owner_id=? ORDER BY accessed_at DESC LIMIT 100",
          user.id,
        ).all();
        return json({ history: r.results });
      }
      if (request.method === "POST") {
        const b = await body(request);
        if (!hashOk(b.hash)) throw new HttpError("Hash inválido.");
        await query(
          "INSERT INTO history (id,owner_id,hash,file_id,file_name,accessed_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id,hash) DO UPDATE SET accessed_at=excluded.accessed_at,file_id=excluded.file_id",
          uuid(),
          user.id,
          b.hash,
          str(b.fileId) || null,
          str(b.fileName),
          now(),
        ).run();
        return json({ ok: true });
      }
    }
    if (route === "exports") {
      const u = await requireUser();
      if (request.method === "POST") {
        const b = await body(request);
        if (!hashOk(b.hash) || !["csv", "xlsx", "json"].includes(b.format))
          throw new HttpError("Exportação inválida.");
        await query(
          "INSERT INTO exports_log (id,owner_id,analysis_id,hash,format,count,created_at) VALUES (?,?,?,?,?,?,?)",
          uuid(),
          u.id,
          str(b.analysisId),
          b.hash,
          b.format,
          Number(b.count) || 0,
          now(),
        ).run();
        return json({ ok: true });
      }
      return json({
        exports: (
          await query(
            "SELECT * FROM exports_log WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
            u.id,
          ).all()
        ).results,
      });
    }
    if (route === "my-files") {
      const u = await requireUser();
      return json({
        files: (
          await query(
            "SELECT * FROM files WHERE owner_id=? ORDER BY created_at DESC",
            u.id,
          ).all()
        ).results.map(parseFile),
      });
    }
    if (route === "admin") {
      const u = await requireUser(["admin"]);
      if (id === "users") {
        if (request.method === "GET")
          return json({
            users: (
              await query(
                "SELECT * FROM users ORDER BY created_at DESC LIMIT 500",
              ).all()
            ).results,
          });
        const b = await body(request);
        if (!["user", "publisher", "admin"].includes(b.role) || b.id === u.id)
          throw new HttpError("Papel inválido ou alteração da própria conta.");
        await query("UPDATE users SET role=? WHERE id=?", b.role, b.id).run();
        return json({ ok: true });
      }
      if (id === "files") {
        if (request.method === "GET")
          return json({
            files: (
              await query(
                "SELECT * FROM files ORDER BY created_at DESC LIMIT 500",
              ).all()
            ).results.map(parseFile),
          });
        const b = await body(request);
        if (!["validated", "review", "pending", "archived"].includes(b.status))
          throw new HttpError("Status inválido.");
        if (b.status === "validated" && (!b.reviewed || !str(b.note)))
          throw new HttpError(
            "Abra o arquivo, revise os dados e registre uma justificativa.",
          );
        await query(
          "UPDATE files SET status=?,collection=COALESCE(?,collection),review_note=?,reviewer_id=?,published_at=? WHERE id=?",
          b.status,
          str(b.collection) || null,
          str(b.note, 2000),
          u.id,
          b.status === "validated" ? now() : null,
          b.id,
        ).run();
        return json({ ok: true });
      }
    }
    throw new HttpError("Recurso não encontrado.", 404);
  } catch (e: any) {
    if (!(e instanceof HttpError)) console.error("[STRATA API]", e);
    return json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : "Serviço temporariamente indisponível. Seus dados não foram descartados.",
      },
      e.status || 503,
    );
  }
}
