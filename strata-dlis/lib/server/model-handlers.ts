import { z } from "zod";
import { fileModel } from "../model/file-model";
import { wellInput, wellLinkInput, reportInput } from "../model/contracts";
import { query } from "./db";
import { HttpError, requireUser } from "./auth";
import { mayRead } from "../dlis/core.js";

type User = { id: string; role: string };
type FileRow = {
  id: string;
  hash: string;
  owner_id: string;
  status: string;
  visibility: string;
  metadata: string;
  original_name: string;
  well: string | null;
};
type AnalysisRow = {
  id: string;
  owner_id: string;
  hash: string;
  file_name: string;
  name: string;
  points: string;
  settings: string;
  updated_at: string;
};
type ReportRow = {
  id: string;
  content: string;
  source_snapshot: string;
  [key: string]: unknown;
};
const missing = () =>
  new HttpError("Arquivo não encontrado ou sem permissão.", 404);
async function readInput<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 500_000)
    throw new HttpError("Conteúdo excede o limite permitido.", 413);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError("Dados inválidos.");
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError("Dados inválidos.");
  return result.data;
}
async function readableFile(id: string, user: User) {
  const file = await query(
    "SELECT id,hash,owner_id,status,visibility,metadata,original_name,well FROM files WHERE id=?",
    id,
  ).first<FileRow>();
  if (!file || file.status === "deleting" || !mayRead(file, user))
    throw missing();
  return file;
}
async function linkFor(fileId: string) {
  return query("SELECT well_id FROM file_wells WHERE file_id=?", fileId).first<{
    well_id: string;
  }>();
}
const parseAnalysis = (a: AnalysisRow) => ({
  ...a,
  points: JSON.parse(a.points),
  settings: JSON.parse(a.settings),
});
const parseReport = (r: ReportRow) => ({
  ...r,
  content: JSON.parse(r.content),
  source_snapshot: JSON.parse(r.source_snapshot),
});

/** All responses pass through the existing no-store JSON wrapper and origin check. */
export async function modelHandler(
  request: Request,
  path: string[],
): Promise<unknown | undefined> {
  const [route, id, action] = path;
  if (!(
    route === "wells" ||
    route === "reports" ||
    route === "interpretations" ||
    (route === "files" && id && ["model", "well"].includes(action))
  ))
    return undefined;
  const user: User = await requireUser();
  if (path.length > (route === "files" ? 3 : 2)) throw missing();
  if (route === "files") {
    const file = await readableFile(id, user);
    if (action === "model" && request.method === "GET") {
      return {
        fileId: file.id,
        declaredWell: file.well,
        wellId: (await linkFor(id))?.well_id ?? null,
        ...fileModel(file.hash, file.metadata),
      };
    }
    if (action === "well" && request.method === "PUT") {
      if (file.owner_id !== user.id && user.role !== "admin") throw missing();
      const input = await readInput(request, wellLinkInput);
      // Even admins must link within the file owner's workspace.
      const well = await query(
        "SELECT id FROM wells WHERE id=? AND owner_id=?",
        input.wellId,
        file.owner_id,
      ).first();
      if (!well) throw missing();
      await query(
        "INSERT INTO file_wells(file_id,well_id) VALUES (?,?) ON CONFLICT(file_id) DO UPDATE SET well_id=excluded.well_id",
        id,
        input.wellId,
      ).run();
      return { fileId: id, wellId: input.wellId };
    }
  }
  if (route === "wells") {
    if (request.method === "GET") {
      if (id) {
        const well = await query(
          "SELECT * FROM wells WHERE id=? AND owner_id=?",
          id,
          user.id,
        ).first();
        if (!well) throw missing();
        const files = await query(
          "SELECT f.id,f.hash,f.original_name,f.well,f.status FROM files f JOIN file_wells fw ON fw.file_id=f.id WHERE fw.well_id=? AND f.owner_id=? AND f.status!='deleting' ORDER BY f.created_at DESC",
          id,
          user.id,
        ).all();
        return { well, files: files.results };
      }
      return {
        wells: (
          await query(
            "SELECT * FROM wells WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 500",
            user.id,
          ).all()
        ).results,
      };
    }
    if (request.method === "POST" && !id) {
      const input = await readInput(request, wellInput),
        wellId = crypto.randomUUID(),
        now = new Date().toISOString();
      await query(
        "INSERT INTO wells(id,owner_id,name,field,company,identifier,origin,created_at,updated_at) VALUES (?,?,?,?,?,?,'manual',?,?)",
        wellId,
        user.id,
        input.name,
        input.field ?? null,
        input.company ?? null,
        input.identifier ?? null,
        now,
        now,
      ).run();
      return { id: wellId };
    }
  }
  if (route === "interpretations" && request.method === "GET") {
    const rows = await query(
      `SELECT a.*,f.id AS file_id,fw.well_id FROM analyses a
      LEFT JOIN files f ON f.hash=a.hash AND f.status!='deleting'
        AND (f.owner_id=? OR ?='admin' OR (f.status='validated' AND f.visibility!='private'))
      LEFT JOIN file_wells fw ON fw.file_id=f.id
      WHERE a.owner_id=? ${id ? "AND a.id=?" : ""} ORDER BY a.updated_at DESC LIMIT 200`,
      ...[user.id, user.role, user.id, ...(id ? [id] : [])],
    ).all<AnalysisRow>();
    if (id && !rows.results.length) throw missing();
    return { interpretations: rows.results.map(parseAnalysis) };
  }
  if (route === "reports") {
    if (request.method === "GET") {
      if (!id)
        return {
          reports: (
            await query(
              "SELECT id,title,source_hash,file_id,well_id,analysis_id,schema_version,created_at FROM reports WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 200",
              user.id,
            ).all()
          ).results,
        };
      const report = await query(
        "SELECT * FROM reports WHERE id=? AND owner_id=?",
        id,
        user.id,
      ).first<ReportRow>();
      if (!report) throw missing();
      return { report: parseReport(report) };
    }
    if (request.method === "DELETE" && id) {
      const result = await query(
        "DELETE FROM reports WHERE id=? AND owner_id=?",
        id,
        user.id,
      ).run();
      if (!result.meta.changes) throw missing();
      return { ok: true };
    }
    if (request.method === "POST" && !id) {
      const input = await readInput(request, reportInput);
      const analysis = input.analysisId
        ? await query(
            "SELECT * FROM analyses WHERE id=? AND owner_id=?",
            input.analysisId,
            user.id,
          ).first<AnalysisRow>()
        : null;
      if (input.analysisId && !analysis) throw missing();
      const file = input.fileId ? await readableFile(input.fileId, user) : null;
      if (analysis && file && analysis.hash !== file.hash)
        throw new HttpError("Dados inválidos.");
      const hash = file?.hash ?? analysis!.hash;
      const wellId = file ? ((await linkFor(file.id))?.well_id ?? null) : null;
      const snapshot = JSON.stringify({
        schemaVersion: 1,
        sourceHash: hash,
        wellId,
        file: file
          ? { id: file.id, name: file.original_name, declaredWell: file.well }
          : null,
        interpretation: analysis ? parseAnalysis(analysis) : null,
      });
      if (new TextEncoder().encode(snapshot).length > 1_000_000)
        throw new HttpError("Conteúdo excede o limite permitido.", 413);
      const reportId = crypto.randomUUID();
      await query(
        "INSERT INTO reports(id,owner_id,file_id,well_id,analysis_id,source_hash,title,schema_version,content,source_snapshot,created_at) VALUES (?,?,?,?,?,?,?,1,?,?,?)",
        reportId,
        user.id,
        file?.id ?? null,
        wellId,
        analysis?.id ?? null,
        hash,
        input.title,
        JSON.stringify(input.content),
        snapshot,
        new Date().toISOString(),
      ).run();
      return { id: reportId };
    }
  }
  throw new HttpError("Método não permitido.", 405);
}
