import { z } from "zod";

const strings = z.array(z.string()).catch([]);
const summarySchema = z.object({
  wells: strings,
  fields: strings,
  tools: strings,
  dates: strings,
  toolDetails: z
    .array(
      z.object({
        name: z.string(),
        genericName: z.string(),
        trademarkName: z.string(),
      }),
    )
    .catch([]),
  channels: z.array(z.object({ name: z.string(), unit: z.string() })).catch([]),
  ranges: z.array(z.tuple([z.number(), z.number()])).catch([]),
  samples: z.number().int().nonnegative().nullable().catch(null),
  frameCount: z.number().int().nonnegative().catch(0),
  thumbnail: z
    .object({
      lf: z.number().int(),
      frame: z.string(),
      channel: z.string(),
      unit: z.string(),
      points: z.array(z.tuple([z.number(), z.number()]).nullable()).max(132),
    })
    .nullable()
    .catch(null),
});
/** Safe, display-only shape for the public DLIS catalog. */
export type CatalogFile = {
  id: string;
  summary?: z.infer<typeof summarySchema>;
  collection: string;
  well: string | null;
  company: string | null;
  field: string | null;
  run: string | null;
  original_name: string;
  location: string;
  types: string[];
  depth_label: string | null;
  size: number;
  publisher: string;
  published_at: string | null;
};

const asText = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/**
 * Reject unexpected API envelopes before React state is updated.
 * Normalize optional fields so a malformed publication cannot crash rendering.
 */
export function readCatalogFiles(response: unknown): CatalogFile[] {
  if (
    !response ||
    typeof response !== "object" ||
    !("files" in response) ||
    !Array.isArray(response.files)
  ) {
    throw new Error("Dados inválidos.");
  }

  return response.files.map((entry: unknown): CatalogFile => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Dados inválidos.");
    }
    const file = entry as Record<string, unknown>;
    if (
      typeof file.id !== "string" ||
      !file.id ||
      typeof file.collection !== "string"
    ) {
      throw new Error("Dados inválidos.");
    }

    return {
      id: file.id,
      summary: summarySchema.safeParse(file.summary).data,
      collection: file.collection,
      well: asText(file.well),
      company: asText(file.company),
      field: asText(file.field),
      run: asText(file.run),
      original_name: asText(file.original_name) ?? "",
      location: asText(file.location) ?? "unknown",
      types: Array.isArray(file.types)
        ? file.types.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      depth_label: asText(file.depth_label),
      size:
        typeof file.size === "number" &&
        Number.isFinite(file.size) &&
        file.size >= 0
          ? file.size
          : 0,
      publisher: asText(file.publisher) ?? "",
      published_at: asText(file.published_at),
    };
  });
}

export const emptyTechnicalFilters = {
  well: "",
  field: "",
  curve: "",
  tool: "",
  minDepth: "",
  maxDepth: "",
};
export function matchesTechnicalFilters(
  file: CatalogFile,
  filter: typeof emptyTechnicalFilters,
) {
  const s = file.summary;
  const matches = (values: (string | null)[], term: string) =>
    !term.trim() ||
    values.some((v) => v?.toLowerCase().includes(term.trim().toLowerCase()));
  const lo = filter.minDepth === "" ? -Infinity : Number(filter.minDepth);
  const hi = filter.maxDepth === "" ? Infinity : Number(filter.maxDepth);
  return (
    matches([file.well, ...(s?.wells || [])], filter.well) &&
    matches([file.field, ...(s?.fields || [])], filter.field) &&
    matches(s?.channels.map((c) => c.name) || [], filter.curve) &&
    matches(s?.tools || [], filter.tool) &&
    lo <= hi &&
    ((!filter.minDepth && !filter.maxDepth) ||
      !!s?.ranges.some(([a, b]) => b >= lo && a <= hi))
  );
}
