// Deterministic RP66 V1 bytes; all measurements below are SYNTHETIC test data.
import { writeFileSync } from "node:fs";
export const cat = (...xs) => Buffer.concat(xs.map((x) => Buffer.from(x)));
export const uv = (n) =>
  n < 128
    ? Buffer.from([n])
    : n < 16384
      ? Buffer.from([0x80 | (n >> 8), n & 255])
      : Buffer.from([
          0xc0 | (n >>> 24),
          (n >>> 16) & 255,
          (n >>> 8) & 255,
          n & 255,
        ]);
export const id = (s) => cat([Buffer.byteLength(s)], Buffer.from(s));
export const ob = (s) => cat(uv(1), [0], id(s));
const f32 = (x) => {
  const b = Buffer.alloc(4);
  b.writeFloatBE(x);
  return b;
};
const u16 = (x) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(x);
  return b;
};
const val = (rc, x) =>
  rc === 19 || rc === 27
    ? id(x)
    : rc === 20
      ? cat(uv(Buffer.byteLength(x)), Buffer.from(x))
      : rc === 23
        ? ob(x)
        : rc === 2
          ? f32(x)
          : Buffer.from([x]);
function set(type, attrs, objects) {
  const template = attrs.map(([label, rc, count = 1]) =>
    cat([0x3c], id(label), uv(count), [rc]),
  );
  return cat(
    [0xf0],
    id(type),
    ...template,
    ...objects.map(([name, values]) =>
      cat(
        [0x70],
        ob(name),
        ...attrs.map(([, rc, count = 1], i) =>
          cat(
            [0x21],
            ...Array.from({ length: count }, (_, j) =>
              val(rc, count === 1 ? values[i] : values[i][j]),
            ),
          ),
        ),
      ),
    ),
  );
}
export function record(body, attr = 0x80, type = 0) {
  const pad = (body.length + 4) % 2;
  const segment = cat(
    u16(body.length + 4 + pad),
    [attr | (pad ? 1 : 0), type],
    body,
    pad ? [1] : [],
  );
  return cat(u16(segment.length + 4), [255, 1], segment);
}
export function makeFixture({ rows = 1201, encrypted = false } = {}) {
  const channels = [
    ["TDEP", "m", 1],
    ["DEPTH", "m", 1],
    ["GR", "gAPI", 1],
    ["CBL", "mV", 1],
    ["VDL", "", 128],
    ["AIBK", "MRayl", 36],
  ];
  const records = [
    record(
      set("FILE-HEADER", [["ID", 20]], [["F", ["SYNTHETIC STRATA QA"]]]),
      0x80,
      0,
    ),
    record(
      set(
        "ORIGIN",
        [
          ["WELL-NAME", 20],
          ["COMPANY", 20],
        ],
        [["O", ["Synthetic QA well", "Test only"]]],
      ),
      0x80,
      1,
    ),
    record(
      set(
        "CHANNEL",
        [
          ["REPRESENTATION-CODE", 15],
          ["DIMENSION", 15],
          ["UNITS", 27],
          ["LONG-NAME", 20],
        ],
        channels.map(([n, u, d]) => [n, [2, d, u, n]]),
      ),
      0x80,
      3,
    ),
    record(
      set(
        "FRAME",
        [
          ["CHANNELS", 23, channels.length],
          ["INDEX-TYPE", 19],
        ],
        [["FRAME", [channels.map((c) => c[0]), "BOREHOLE-DEPTH"]]],
      ),
      0x80,
      4,
    ),
  ];
  if (encrypted)
    records.push(
      record(Buffer.from([4, 2, 8, 9, 9, 3, 1, 2, 3, 4, 5, 6]), 0x90, 132),
    );
  for (let i = 0; i < rows; i++) {
    const d = 1000 + i * 0.1 + (i > 600 ? 10 : 0);
    const missing = i >= 400 && i <= 420;
    const values = [
      d,
      d + 0.05,
      missing ? -999.25 : 80 + 30 * Math.sin(i / 30),
      missing ? -999.25 : 20 + 15 * Math.sin(i / 90),
    ];
    for (let c = 0; c < 128; c++)
      values.push(
        missing
          ? -999.25
          : Math.sin(c * 0.3 - i * 0.04) *
              Math.exp(-(((c - 45) / 40) ** 2)) *
              24000,
      );
    for (let c = 0; c < 36; c++)
      values.push(
        missing
          ? -2000
          : 5 + 3 * Math.sin(i / 60) * Math.cos((c / 36) * Math.PI * 2),
      );
    records.push(record(cat(ob("FRAME"), uv(i + 1), ...values.map(f32)), 0, 0));
  }
  return cat(
    Buffer.from("0001V1.00RECORD 8192SYNTHETIC TEST DATA".padEnd(80, " ")),
    ...records,
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2])
  writeFileSync(process.argv[2], makeFixture());
