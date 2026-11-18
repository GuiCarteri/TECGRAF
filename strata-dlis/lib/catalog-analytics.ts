import type { CatalogFile } from "./catalog";

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function catalogAnalytics(
  files: readonly CatalogFile[],
  locale: string,
) {
  const collections = new Map<string, number>();
  const profiles = new Map<string, number>();
  const environments = { onshore: 0, offshore: 0, unknown: 0 };
  let bytes = 0;
  let unclassified = 0;
  const compare = new Intl.Collator(locale, { numeric: true }).compare;
  for (const file of files) {
    bytes += file.size;
    increment(collections, file.collection);
    const types = new Set(
      file.types.map((t) => t.trim().toUpperCase()).filter(Boolean),
    );
    if (!types.size) unclassified++;
    for (const type of types) increment(profiles, type);
    const location = file.location;
    environments[
      location === "onshore" || location === "offshore" ? location : "unknown"
    ]++;
  }
  const ranked = (counts: Map<string, number>) =>
    [...counts].sort(([a, x], [b, y]) => y - x || compare(a, b));
  const largest = [...files]
    .sort(
      (a, b) =>
        b.size - a.size ||
        compare(a.original_name, b.original_name) ||
        compare(a.id, b.id),
    )
    .slice(0, 5);
  return {
    count: files.length,
    bytes,
    collections: ranked(collections),
    profiles: ranked(profiles),
    environments,
    unclassified,
    largest,
  };
}
