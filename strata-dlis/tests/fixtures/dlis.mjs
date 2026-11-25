// Deterministic RP66 V1 bytes; all measurements below are SYNTHETIC test data.
import { mkdirSync, writeFileSync } from "node:fs";
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
  rc === 21 ? Buffer.from(x) : rc === 19 || rc === 27
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
export function makeFixture({ rows = 1201, encrypted = false, catalogDetails = false, petrophysics = false, depthOffset = 0, wellName = "Synthetic QA well" } = {}) {
  const channels = [
    ["TDEP", "m", 1],
    ["DEPTH", "m", 1],
    ["GR", "gAPI", 1],
    ["CBL", "mV", 1],
    ["VDL", "", 128],
    ["AIBK", "MRayl", 36],
    ...(petrophysics ? [["SP","mV",1],["ILD","ohm.m",1],["LLS","ohm.m",1],["RHOB","g/cm3",1],["NPHI","v/v",1],["DT","us/ft",1],["CALI","in",1]] : []),
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
          ...(catalogDetails ? [["FIELD-NAME",20], ["CREATION-TIME",21]] : []),
        ],
        [["O", [wellName, "Test only", ...(catalogDetails ? ["Delta sintético", [126, 0x23, 15, 12, 30, 0, 0, 0]] : [])]]],
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
  if (catalogDetails) records.push(record(set("TOOL", [["GENERIC-NAME",20],["TRADEMARK-NAME",20]], [["QA-GR",["Gamma Ray","Demo Sonde"]]]),0x80,7));
  if (encrypted)
    records.push(
      record(Buffer.from([4, 2, 8, 9, 9, 3, 1, 2, 3, 4, 5, 6]), 0x90, 132),
    );
  for (let i = 0; i < rows; i++) {
    const d = 1000 + depthOffset + i * 0.1 + (i > 600 ? 10 : 0);
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
    if(petrophysics) values.push(...[-32+8*Math.sin(i/16),Math.exp(2+1.8*Math.sin(i/19)),Math.exp(2+1.2*Math.cos(i/19)),2.42+.20*Math.sin(i/23),.15+.13*Math.cos(i/26),64+14*Math.cos(i/29),8.6+.5*Math.sin(i/10)].map(v=>missing?-999.25:v));
    records.push(record(cat(ob("FRAME"), uv(i + 1), ...values.map(f32)), 0, 0));
  }
  return cat(
    Buffer.from("0001V1.00RECORD 8192SYNTHETIC TEST DATA".padEnd(80, " ")),
    ...records,
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2]) {
  if (process.argv[2] === "--profiles") {
    const directory = "test-results/phase4-samples";
    mkdirSync(directory, { recursive: true });
    for (const [name, depthOffset] of [["Aurora", 0], ["Boreal", 5]]) {
      const path = directory + "/" + name + "-synthetic.dlis";
      writeFileSync(path, makeFixture({ wellName: name + " (sintético)", depthOffset, rows: 1000, petrophysics: true }));
      console.log(path);
    }
  } else {
    writeFileSync(process.argv[2], makeFixture());
  }
}
