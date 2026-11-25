import { query } from "./db";
import { HttpError } from "./errors";

export async function publicCatalog(params: URLSearchParams) {
  const clauses = ["f.status='validated'", "f.visibility='public'"];
  const args: (string | number)[] = [];
  for (const [param, path, item] of [
    ["well", "wells", "j.value"],
    ["field", "fields", "j.value"],
    ["curve", "channels", "j.value->>'$.name'"],
    ["tool", "tools", "j.value"],
  ]) {
    const term = params.get(param)?.trim();
    if (!term) continue;
    if (term.length > 254) throw new HttpError("Filtro inválido.");
    const label =
      param === "well" || param === "field"
        ? "instr(lower(f." + param + "),lower(?)) OR "
        : "";
    clauses.push(
      "(" +
        label +
        "EXISTS(SELECT 1 FROM json_each(i.summary,'$." +
        path +
        "') j WHERE instr(lower(" +
        item +
        "),lower(?))))",
    );
    if (label) args.push(term);
    args.push(term);
  }
  const depth = (name: string) => {
    const v = params.get(name)?.trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new HttpError("Filtro inválido.");
    return n;
  };
  const lo = depth("minDepth"),
    hi = depth("maxDepth");
  if (lo !== null && hi !== null && lo > hi)
    throw new HttpError("Intervalo de profundidade inválido.");
  if (lo !== null || hi !== null) {
    const overlap = [];
    if (lo !== null) {
      overlap.push("r.value->>'$[1]' >= ?");
      args.push(lo);
    }
    if (hi !== null) {
      overlap.push("r.value->>'$[0]' <= ?");
      args.push(hi);
    }
    clauses.push(
      "EXISTS(SELECT 1 FROM json_each(i.summary,'$.ranges') r WHERE " +
        overlap.join(" AND ") +
        ")",
    );
  }
  const result = await query(
    "SELECT f.id,f.well,f.field,f.company,f.collection,f.run,f.location,f.types,f.depth_label,f.size,f.publisher,f.published_at,f.status,f.original_name,i.summary FROM files f JOIN catalog_index i ON i.file_id=f.id WHERE " +
      clauses.join(" AND ") +
      " ORDER BY f.collection,f.published_at DESC,f.id",
    ...args,
  ).all<{ types: string; summary: string }>();
  return {
    files: result.results.map((row) => ({
      ...row,
      types: JSON.parse(row.types || "[]"),
      summary: JSON.parse(row.summary),
    })),
  };
}
