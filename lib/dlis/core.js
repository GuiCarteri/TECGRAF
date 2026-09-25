// No colors, interpolation or rounding ever enter the raw-array lookup path.
export const PALETTE = {
  gas: "#FF0000",
  liquid: "#00FFFF",
  cement: "#FFFFCC",
  high: "#000000",
  missing: "#008000",
  invalid: "#808080",
};
export const isDlisName = (name) => /\.dlis$/i.test(name);
export function validateHeader(buffer) {
  const b = new Uint8Array(buffer);
  if (b.length < 84) throw new Error("Arquivo não parece ser DLIS RP66 V1.");
  const label = new TextDecoder("ascii").decode(b.subarray(0, 80));
  if (label.slice(4, 9) !== "V1.00" || label.slice(9, 15) !== "RECORD")
    throw new Error("Arquivo não parece ser DLIS RP66 V1.");
  return true;
}
export async function sha256(buffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function rawAt(data, stride, sample, component) {
  if (
    !Number.isInteger(stride) ||
    stride < 1 ||
    !Number.isInteger(sample) ||
    !Number.isInteger(component) ||
    sample < 0 ||
    component < 0 ||
    component >= stride ||
    sample * stride + component >= data.length
  )
    throw new Error("Índice fora do array original.");
  return data[sample * stride + component];
}
export function validity(value) {
  return !Number.isFinite(value)
    ? "Inválido"
    : [-999.25, -9999.25, -99999, -9999, -2000].includes(value)
      ? "Sem leitura"
      : "Válido";
}
export function usit(value) {
  if (value === -2000) return { zone: "Sem leitura", color: PALETTE.missing };
  if (!Number.isFinite(value) || value < 0)
    return { zone: "Inválido", color: PALETTE.invalid };
  if (value < 0.3) return { zone: "Gás", color: PALETTE.gas };
  if (value < 2.6) return { zone: "Líquido", color: PALETTE.liquid };
  if (value >= 10) return { zone: "Impedância elevada", color: PALETTE.high };
  const t = (value - 2.6) / 7.4;
  return {
    zone: "Cimento",
    color: `rgb(${Math.round(255 * (1 - t))}, ${Math.round(255 * (1 - t))}, ${Math.round(204 * (1 - t))})`,
  };
}
export const normalizeCompany = (s) =>
  (s || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
export function companyMatches(detected, confirmed) {
  return (
    !!normalizeCompany(detected) &&
    normalizeCompany(detected) === normalizeCompany(confirmed)
  );
}
export const mayPublish = (role) => ["publisher", "admin"].includes(role);
export const mayRead = (f, u) =>
  !!u &&
  ((f.status === "validated" && f.visibility !== "private") ||
    f.owner_id === u.id ||
    u.role === "admin");
export function csvCell(value) {
  const v =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(value)
        : ""
      : String(value ?? "");
  const safe =
    typeof value === "string" && /^[\s]*[=+@-]/.test(v) ? "'" + v : v;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export const pointFields = [
  "fileHash",
  "fileName",
  "analysisId",
  "logicalFile",
  "logicalFileIndex",
  "frame",
  "frameKey",
  "channel",
  "channelKey",
  "sampleIndex",
  "frameNumber",
  "componentIndex",
  "dimensions",
  "depth",
  "depthUnit",
  "curve",
  "rawValue",
  "unit",
  "validity",
  "timeUs",
  "azimuth",
  "zone",
  "microDebonding",
  "automaticClassification",
  "manualClassification",
  "reference",
  "observation",
];
export const pointsCSV = (points) =>
  "\uFEFF" +
  [
    pointFields.map(csvCell).join(","),
    ...points.map((p) =>
      pointFields
        .map((k) =>
          csvCell(
            typeof p[k] === "object" && p[k] !== null
              ? JSON.stringify(p[k])
              : p[k],
          ),
        )
        .join(","),
    ),
  ].join("\r\n");
export function unitKind(u) {
  const s = (u || "").toLowerCase().replace(/\s/g, "");
  if (["m", "meter", "metre", "meters"].includes(s)) return "m";
  if (["ft", "feet", "foot"].includes(s)) return "ft";
  if (["mm", "cm", "in", "0.1in"].includes(s)) return s;
  return null;
}
export const metersFactor = (u) =>
  ({ m: 1, ft: 0.3048, mm: 0.001, cm: 0.01, in: 0.0254, "0.1in": 0.00254 })[
    unitKind(u)
  ] ?? null;
export const isMRayl = (u) => /^(mrayl|mrayls|mr)$/i.test((u || "").trim());
// Suggestions need both semantic evidence and compatible dimensions/units.
export function detectChannel(ch, stride) {
  const n = String(ch.name || "").toUpperCase(),
    desc = typeof ch.longName === "string" ? ch.longName.toUpperCase() : "";
  const text = n + " " + desc,
    u = (ch.units || "").trim();
  if (
    stride === 1 &&
    unitKind(u) &&
    (/^(DEPTH|TDEP|DEPT|MD|TVD|DBTM)$/.test(n) || /DEPTH/.test(desc))
  )
    return "DEPTH";
  if (
    stride === 1 &&
    /^(gapi|api)$/i.test(u) &&
    (/^(GR|SGR|CGR)$/.test(n) || /GAMMA/.test(desc))
  )
    return "GR";
  if (
    stride === 1 &&
    /^mv$/i.test(u) &&
    (/^(CBL|AMP3FT)$/.test(n) || /CEMENT BOND|3.FT.*AMPLITUDE/.test(desc))
  )
    return "CBL";
  if (
    stride > 1 &&
    isMRayl(u) &&
    /IMPEDANCE|USIT|AIBK|ACOUSTIC.*IMAGE/.test(text)
  )
    return "USIT";
  if (stride > 1 && /VDL|WAVEFORM|VARIABLE DENSITY/.test(text)) return "VDL";
  return "OTHER";
}
export function extractMetadata(dlis) {
  return {
    version: dlis.sul.version,
    warnings: dlis.warnings,
    logicalFiles: dlis.logicalFiles.map((lf, i) => ({
      index: i,
      id: lf.id,
      origin: lf.origin,
      parameters: lf.parameters,
      frames: [...lf.frames.values()].map((f) => ({
        key: f.key,
        name: f.name,
        description: f.description,
        indexType: f.indexType,
        direction: f.direction,
        spacing: f.spacing,
        channels: f.channels.map((c) => ({
          ...c,
          kind: detectChannel(
            c,
            c.dimension.reduce((a, b) => a * b, 1),
          ),
        })),
        channelNames: f.channelNames,
      })),
    })),
  };
}
export function numericRange(values) {
  let min = Infinity,
    max = -Infinity;
  for (const v of values)
    if (validity(v) === "Válido") {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  return Number.isFinite(min) ? [min, max] : null;
}
// Sort indices only: original data arrays and sample indices remain unchanged.
export function depthIndex(data) {
  const indices = [];
  for (let i = 0; i < data.length; i++)
    if (validity(data[i]) === "Válido") indices.push(i);
  indices.sort((a, b) => data[a] - data[b]);
  const diffs = [];
  for (let k = 1; k < indices.length; k++) {
    const d = data[indices[k]] - data[indices[k - 1]];
    if (d > 0) diffs.push(d);
  }
  diffs.sort((a, b) => a - b);
  return {
    indices,
    step: diffs.length ? diffs[Math.floor(diffs.length / 2)] : 0,
  };
}
export function nearestSample(data, index, target, maxDistance = Infinity) {
  const list = index.indices;
  if (!list.length) return null;
  let l = 0,
    r = list.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (data[list[m]] < target) l = m + 1;
    else r = m;
  }
  let k = Math.min(l, list.length - 1);
  if (
    k > 0 &&
    Math.abs(data[list[k - 1]] - target) < Math.abs(data[list[k]] - target)
  )
    k--;
  return Math.abs(data[list[k]] - target) <= maxDistance ? list[k] : null;
}
export function agcRow(data, start, stride) {
  let sum = 0,
    n = 0;
  for (let c = 0; c < stride; c++) {
    const v = data[start + c];
    if (validity(v) === "Válido") {
      sum += v * v;
      n++;
    }
  }
  return n ? Math.sqrt(sum / n) || 1 : 1;
}
