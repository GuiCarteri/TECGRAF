import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { codespaceHost } from "./scripts/dev-config";
import { rewriteVinextShimProxy } from "./scripts/vinext-shim-proxy";

function fixVinextRscProxyImports(): Plugin {
  return {
    name: "strata:fix-vinext-rsc-proxy-imports",
    enforce: "pre",
    transform(code, id) {
      if (
        !id.includes("client-in-server-package-proxy/") ||
        !id.includes("/vinext/dist/shims/")
      )
        return null;
      const fixed = rewriteVinextShimProxy(code);
      return fixed === code ? null : { code: fixed, map: null };
    },
  };
}

const forwardedHost = codespaceHost(process.env);
export default defineConfig({
  // O Worker usa estes módulos na primeira leitura. A pré-otimização preserva o arquivo aberto.
  environments: { client: { optimizeDeps: { include: ["@noble/hashes/sha2.js", "@noble/hashes/utils.js"] } } },
  server: {
    host: forwardedHost ? "0.0.0.0" : "127.0.0.1",
    port: 5173,
    strictPort: true,
    open: false,
  },
  plugins: [
    {
      name: "strata:codespaces-forwarding",
      config(config) {
        const host = codespaceHost(process.env, config.server?.port);
        if (host) {
          return { server: { allowedHosts: [host], ws: { protocol: "wss", host, clientPort: 443 } } };
        }
      },
    },
    fixVinextRscProxyImports(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
    }),
  ],
});
