/**
 * Vite RSC can emit virtual client-in-server-package-proxy modules that import
 * Vinext's private shim files by absolute (or slash-stripped) filesystem paths.
 * Vite import-analysis treats those as URL paths and fails to resolve them.
 *
 * Use Vinext's public package subpath exports instead. Only generated virtual
 * proxies are transformed (see vite.config.ts); installed dependencies remain
 * untouched, and no production application imports are changed.
 */
export function rewriteVinextShimProxy(source: string): string {
  return source.replace(
    /(["'])(?:[^"'\r\n]*\/)?node_modules\/vinext\/dist\/shims\/([a-z][a-z0-9-]*)\.js\1/g,
    (_match, quote: string, shim: string) =>
      `${quote}vinext/shims/${shim}${quote}`,
  );
}
