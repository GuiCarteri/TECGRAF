import { z } from "zod";
import { assessReadiness } from "../dlis/readiness.ts";
import type { Track } from "../dlis/plotting";

const score = z.number().min(0).max(100).nullable();
const ratio = z
  .object({
    passed: z.number().nonnegative(),
    total: z.number().nonnegative(),
    fraction: z.number().min(0).max(1).nullable(),
  })
  .strict();
const label = z.string().max(4096);
const curve = z
  .object({
    kind: z.string(),
    name: label,
    key: label,
    frame: label,
    frameKey: label,
    depth: label,
    quality: z
      .object({
        completeness: ratio,
        coverage: ratio,
        consistency: ratio,
        units: ratio,
        plausibility: ratio,
        traceability: ratio,
      })
      .strict(),
  })
  .strict();
export const assessmentSchema = z
  .object({
    version: z.literal(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/i),
    groups: z
      .array(
        z
          .object({
            lf: z.number().int().nonnegative(),
            well: label.nullable(),
            usit: score,
            cblVdl: score,
            curves: z.array(curve).max(4),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();
export type WellAssessment = z.infer<typeof assessmentSchema>;

export function wellAssessment(
  tracks: Record<string, Track>,
  hash: string,
  logicalFiles: { index: number; origin?: { wellName?: unknown } | null }[],
): WellAssessment {
  const groups = new Map<number, Record<string, Track>>();
  for (const track of Object.values(tracks)) {
    const group = groups.get(track.lf) ?? {};
    group[track.kind] = track;
    groups.set(track.lf, group);
  }
  return {
    version: 1,
    hash,
    groups: [...groups]
      .sort(([a], [b]) => a - b)
      .map(([lf, selected]) => {
        const well = logicalFiles.find((item) => item.index === lf)?.origin
          ?.wellName;
        const { usit, cblVdl, curves } = assessReadiness(selected, hash);
        return {
          lf,
          well: typeof well === "string" && well.trim() ? well : null,
          usit,
          cblVdl,
          curves: curves.map(({ track, quality }) => ({
            kind: track.kind,
            name: track.channel.name,
            key: track.channel.key ?? "",
            frame: track.frame.name ?? "",
            frameKey: track.frame.key ?? "",
            depth: track.depthName,
            quality,
          })),
        };
      }),
  };
}
export function readWellAssessment(value: unknown, hash: string) {
  const parsed = assessmentSchema.safeParse(value);
  return parsed.success && parsed.data.hash === hash ? parsed.data : null;
}
