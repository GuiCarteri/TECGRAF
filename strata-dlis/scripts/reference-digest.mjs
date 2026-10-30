import { createHash } from "node:crypto";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
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
console.log(
  JSON.stringify({
    channels,
    warnings: parsed.warnings,
    elapsed_ms: Math.round(performance.now() - start),
    peak_rss_mb: Math.round(process.resourceUsage().maxRSS / 1024),
  }),
);
