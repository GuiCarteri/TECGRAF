/**
 * Vite RSC sometimes generates virtual proxies for Vinext shim modules with
 * a filesystem path missing its leading slash (e.g. "workspaces/TECGRAF/...").
 * Restore the absolute path before Vite import-analysis resolves the proxy.
 *
 * This never modifies installed packages, application imports or production
 * assets; it only handles the affected generated virtual proxy modules.
 */
export function rewriteVinextShimProxy(source: string): string {
  return source.replace(
    /(["'])(workspaces\/[^"'\r\n]*\/node_modules\/vinext\/dist\/shims\/[a-z][a-z0-9-]*\.js)\1/g,
    (_match, quote: string, relativePath: string) =>
      `${quote}/${relativePath}${quote}`,
  );
}
