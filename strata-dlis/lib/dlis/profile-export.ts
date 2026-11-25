import {
  makeSheet,
  paintSheet,
  type Column,
  type Sheet,
  type SheetOptions,
} from "./profile-sheet.ts";
const escape = (value: string) =>
  Array.from(value)
    .filter((c) => c.charCodeAt(0) >= 32 || ["\n", "\t", "\r"].includes(c))
    .join("")
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
const coord = (v: number) => String(Math.round(v * 100) / 100);
function svgSheet(sheet: Sheet, index: number) {
  const clipIds = new Map<string, string>();
  const body: string[] = [];
  for (const p of sheet.items) {
    if (p.kind === "rect")
      body.push(
        `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.color}"/>`,
      );
    else if (p.kind === "text")
      body.push(
        `<text x="${p.x}" y="${p.y}" font-family="sans-serif" font-size="${p.size}" fill="${p.color}">${escape(p.text)}</text>`,
      );
    else if (p.kind === "image")
      body.push(
        `<image x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="none" href="${p.canvas.toDataURL("image/png")}"/>`,
      );
    else {
      let clip = "";
      if (p.clip) {
        const key = p.clip.join(","),
          id = clipIds.get(key) || "clip-" + index + "-" + clipIds.size;
        clipIds.set(key, id);
        clip = ` clip-path="url(#${id})"`;
      }
      const d =
        p.points
          .map(([x, y], i) => (i ? "L" : "M") + coord(x) + " " + coord(y))
          .join(" ") + (p.fill ? "Z" : "");
      body.push(
        `<path d="${d}" ${p.fill ? 'fill="' + p.color + '"' : 'fill="none" stroke="' + p.color + '" stroke-width="1.25"'} stroke-dasharray="${p.dash.join(" ") || "none"}"${clip}/>`,
      );
    }
  }
  const defs = Array.from(clipIds, ([key, id]) => {
    const [x, y, w, h] = key.split(",");
    return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`;
  });
  return "<defs>" + defs.join("") + "</defs>" + body.join("");
}
function raster(sheet: Sheet, ratio: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(sheet.width * ratio);
  c.height = Math.ceil(sheet.height * ratio);
  const ctx = c.getContext("2d");
  if (!ctx) throw Error("UNKNOWN_ERROR");
  ctx.scale(ratio, ratio);
  paintSheet(ctx, sheet);
  return c;
}
const blobFrom = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("UNKNOWN_ERROR"))),
      type,
      0.96,
    ),
  );
// Uma página por poço. Os offsets do PDF são calculados pelos bytes efetivamente gravados.
async function pdf(sheets: Sheet[], ratio: number) {
  const encoder = new TextEncoder(),
    parts: BlobPart[] = [],
    offsets = [0];
  let size = 0;
  function write(data: string | ArrayBuffer) {
    const bytes =
      typeof data === "string" ? encoder.encode(data) : new Uint8Array(data);
    parts.push(bytes);
    size += bytes.length;
  }
  function object(id: number, body: string) {
    offsets[id] = size;
    write(id + " 0 obj\n" + body + "\nendobj\n");
  }
  write("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Count ${sheets.length} /Kids [${sheets.map((_, i) => 3 + i * 3 + " 0 R").join(" ")}] >>`,
  );
  for (const [i, sheet] of sheets.entries()) {
    const c = raster(sheet, ratio),
      bytes = await (await blobFrom(c, "image/jpeg")).arrayBuffer(),
      id = 3 + i * 3;
    const w = sheet.width * 0.75,
      h = sheet.height * 0.75,
      command = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    object(
      id + 1,
      `<< /Length ${command.length} >>\nstream\n${command}endstream`,
    );
    offsets[id + 2] = size;
    write(
      `${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.byteLength} >>\nstream\n`,
    );
    write(bytes);
    write("\nendstream\nendobj\n");
  }
  const xref = size;
  write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1))
    write(String(offset).padStart(10, "0") + " 00000 n \n");
  write(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(parts, { type: "application/pdf" });
}
export async function exportProfile(
  columns: Column[],
  options: SheetOptions,
  format: "png" | "svg" | "pdf",
) {
  const ratio = 3.125,
    sheets = columns.map((column) => makeSheet(column, options, ratio));
  const width = sheets.reduce((n, s) => n + s.width, 0),
    height = Math.max(...sheets.map((s) => s.height));
  let blob: Blob;
  if (format === "svg") {
    let x = 0;
    const groups = sheets.map((s, i) => {
      const group = `<g transform="translate(${x} 0)">${svgSheet(s, i)}</g>`;
      x += s.width;
      return group;
    });
    blob = new Blob(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${groups.join("")}</svg>`,
      ],
      { type: "image/svg+xml" },
    );
  } else if (format === "pdf") blob = await pdf(sheets, ratio);
  else {
    const c = document.createElement("canvas");
    c.width = Math.ceil(width * ratio);
    c.height = Math.ceil(height * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) throw Error("UNKNOWN_ERROR");
    ctx.scale(ratio, ratio);
    for (const s of sheets) {
      paintSheet(ctx, s);
      ctx.translate(s.width, 0);
    }
    blob = await blobFrom(c, "image/png");
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `strata-profile-${options.from.toFixed(2)}-${options.to.toFixed(2)}m.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
