/**
 * Vite RSC can generate virtual client proxies that import Vinext shims by
 * filesystem path (sometimes losing the leading slash), which import-analysis
 * cannot resolve. Vinext exposes these shims as public package subpaths.
 *
 * Only rewrite those generated imports, never user code or installed packages.
 */
export function rewriteVinextShimProxy(source: string): string {
  return source.replace(
    /(["'])(?:[^"'\r\n]*\/)?node_modules\/vinext\/dist\/shims\/([a-z][a-z0-9-]*)\.js\1/g,
    (_match, quote: string, shim: string) =>
      `${quote}vinext/shims/${shim}${quote}`,
  );
}
