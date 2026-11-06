export type Region = {
  id: string;
  fileHash: string;
  track: string;
  depthName: string;
  stride: number;
  from: number;
  to: number;
  first: number;
  last: number;
  label: string;
  note: string;
};
export const labels = ["Bom", "Moderado", "Ruim", "Revisar", "Sem leitura"];
export function validateRegions(value: unknown, hash: string): Region[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw Error("Marcações inválidas / Invalid annotations");
  const ids = new Set();
  return value.map((item) => {
    if (!item || typeof item !== "object")
      throw Error("Marcações inválidas / Invalid annotations");
    const r = item as Region;
    if (
      r.fileHash !== hash ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      typeof r.track !== "string" ||
      r.track.length > 512 ||
      !r.track ||
      typeof r.depthName !== "string" ||
      !r.depthName ||
      r.depthName.length > 512 ||
      !Number.isInteger(r.stride) ||
      r.stride < 1 ||
      !Number.isFinite(r.from) ||
      !Number.isFinite(r.to) ||
      r.to <= r.from ||
      !Number.isInteger(r.first) ||
      !Number.isInteger(r.last) ||
      r.first < 0 ||
      r.last < r.first ||
      r.last >= r.stride ||
      !labels.includes(r.label) ||
      typeof r.note !== "string" ||
      r.note.length > 2000
    )
      throw Error("Marcações inválidas / Invalid annotations");
    ids.add(r.id);
    return {
      id: r.id,
      fileHash: hash,
      track: r.track,
      depthName: r.depthName,
      stride: r.stride,
      from: r.from,
      to: r.to,
      first: r.first,
      last: r.last,
      label: r.label,
      note: r.note,
    };
  });
}
export function bounds(
  from: number,
  to: number,
  stride: number,
  a: [number, number],
  b: [number, number],
  interval: boolean,
) {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const component = (x: number) =>
    Math.min(stride - 1, Math.floor(clamp(x) * stride));
  return {
    from: from + Math.min(clamp(a[1]), clamp(b[1])) * (to - from),
    to: from + Math.max(clamp(a[1]), clamp(b[1])) * (to - from),
    first: interval ? 0 : Math.min(component(a[0]), component(b[0])),
    last: interval ? stride - 1 : Math.max(component(a[0]), component(b[0])),
  };
}
export function box(r: Region, from: number, to: number) {
  if (r.to <= from || r.from >= to || to <= from) return null;
  return {
    left: (100 * r.first) / r.stride,
    top: (100 * (Math.max(r.from, from) - from)) / (to - from),
    width: (100 * (r.last - r.first + 1)) / r.stride,
    height: (100 * (Math.min(r.to, to) - Math.max(r.from, from))) / (to - from),
  };
}
