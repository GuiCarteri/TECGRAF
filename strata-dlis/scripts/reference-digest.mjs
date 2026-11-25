import { createHash } from "node:crypto";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { inspectFrames } from "../lib/dlis/inspect.js";
import { defaultDepthChannel } from "../lib/dlis/core.js";
const start = performance.now();
const parsed = await DLISFile.fromFile(process.argv[2]);
const channels = [];
for (const [lf, logical] of parsed.logicalFiles.entries())
  for (const frame of logical.frames.values()) {
    const result = frame.decode();
    for (const ch of frame.channels) {
      const a = result.data[ch.name];
      // Canonical little-endian double values, including NaN, for cross-reader comparison.
      const b = Buffer.allocUnsafe(a.length * 8);
      for (let i = 0; i < a.length; i++)
        b.writeDoubleLE(Number.isNaN(a[i]) ? NaN : a[i], i * 8);
      channels.push({
        lf,
        frame: frame.key,
        channel: ch.key,
        units: ch.units,
        dimensions: ch.dimension,
        rows: result.frameCount,
        count: a.length,
        sha256: createHash("sha256").update(b).digest("hex"),
      });
    }
  }
const catalog = inspectFrames(parsed);
console.log(
  JSON.stringify({
    channels,
    catalog: {
      origins: catalog.logicalFiles.map((l) =>
        l.origins.map((o) => [
          o.wellName,
          o.fieldName,
          o.creationTime?.replace(/Z$/, "") ?? null,
        ]),
      ),
      tools: catalog.logicalFiles.map((l) =>
        l.tools.map((t) => [t.name, t.genericName, t.trademarkName]),
      ),
      frames: catalog.validation.map((v) => ({
        ...v,
        depth: defaultDepthChannel(
          catalog.logicalFiles[v.lf].frames.find((f) => f.key === v.frame),
        ),
      })),
      thumbnail: catalog.thumbnail,
      metadata_bytes: Buffer.byteLength(JSON.stringify(catalog)),
    },
    warnings: parsed.warnings,
    elapsed_ms: Math.round(performance.now() - start),
    peak_rss_mb: Math.round(process.resourceUsage().maxRSS / 1024),
  }),
);
