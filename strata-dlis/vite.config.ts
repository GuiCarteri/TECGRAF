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
  server: {
    host: forwardedHost ? "0.0.0.0" : "127.0.0.1",
    port: 5173,
    strictPort: true,
    open: false,
    allowedHosts: forwardedHost ? [forwardedHost] : [],
    ws: forwardedHost
      ? { protocol: "wss", host: forwardedHost, clientPort: 443 }
      : undefined,
  },
  plugins: [
    fixVinextRscProxyImports(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
    }),
  ],
});
