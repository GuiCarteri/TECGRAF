// Optional validation on an authorized local DLIS. Does not upload its bytes.
import fs from "node:fs";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { validateHeader, sha256, extractMetadata } from "../lib/dlis/core.js";
const file = process.argv[2];
if (!file)
  throw new Error("Use: node scripts/validate-dlis.mjs /path/file.DLIS");
const bytes = fs.readFileSync(file);
const buffer = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength,
);
validateHeader(buffer);
const dlis = DLISFile.fromBuffer(buffer);
let values = 0;
const frames = [];
for (const [lfIndex, lf] of dlis.logicalFiles.entries())
  for (const frame of lf.frames.values()) {
    try {
      const r = frame.decode();
      if (!r) throw new Error("No FDATA");
      let count = 0;
      for (const c of r.channels) {
        const a = r.data[c.name];
        if (a.length !== r.frameCount * r.strides[c.name])
          throw new Error("Shape mismatch");
        count += a.length;
      }
      values += count;
      frames.push({
        logicalFile: lfIndex,
        frame: frame.key,
        samples: r.frameCount,
        channels: r.channels.length,
        values: count,
      });
    } catch (e) {
      frames.push({ logicalFile: lfIndex, frame: frame.key, error: e.message });
    }
  }
console.log(
  JSON.stringify(
    {
      sha256: await sha256(buffer),
      size: bytes.length,
      warnings: dlis.warnings,
      logicalFiles: dlis.logicalFiles.length,
      values,
      frames,
    },
    null,
    2,
  ),
);
