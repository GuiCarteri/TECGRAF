import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
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

export default defineConfig({
  plugins: [
    fixVinextRscProxyImports(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
    }),
  ],
});
