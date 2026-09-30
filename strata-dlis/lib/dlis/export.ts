import { pointFields, pointsCSV } from "./core.js";
export async function exportPoints(
  points: any[],
  format: string,
  hash: string,
) {
  let blob: Blob;
  if (format === "csv")
    blob = new Blob([pointsCSV(points)], { type: "text/csv;charset=utf-8" });
  else if (format === "json")
    blob = new Blob(
      [
        JSON.stringify(
          {
            schema: "strata-points-v1",
            fileHash: hash,
            exportedAt: new Date().toISOString(),
            points,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
  else {
    const XLSX = await import("xlsx");
    const rows = points.map((p) =>
      Object.fromEntries(
        pointFields.map((k) => [
          k,
          typeof p[k] === "object" && p[k] !== null
            ? JSON.stringify(p[k])
            : (p[k] ?? ""),
        ]),
      ),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows, { header: pointFields }),
      "Pontos brutos",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Fonte", "Arrays decodificados do DLIS"],
        ["SHA-256", hash],
        ["Profundidade", "m; conversão explícita da unidade original"],
        ["Índices", "sampleIndex e componentIndex são base 0"],
        ["Ausências", "Células vazias = indisponível"],
        [
          "Precisão",
          "Excel limita números a 15 dígitos. JSON/CSV preservam a representação numérica JS.",
        ],
      ]),
      "Rastreabilidade",
    );
    blob = new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]);
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `strata-pontos-${hash.slice(0, 12)}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
