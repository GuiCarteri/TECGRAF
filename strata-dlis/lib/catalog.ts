/** Safe, display-only shape for the public DLIS catalog. */
export type CatalogFile = {
  id: string;
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
      collection: file.collection,
      well: asText(file.well),
      company: asText(file.company),
      field: asText(file.field),
      run: asText(file.run),
      original_name: asText(file.original_name) ?? "",
      location: asText(file.location) ?? "unknown",
      types: Array.isArray(file.types)
        ? file.types.filter((value): value is string => typeof value === "string")
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
