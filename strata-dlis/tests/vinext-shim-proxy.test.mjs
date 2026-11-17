import test from "node:test";
import assert from "node:assert/strict";
import { rewriteVinextShimProxy } from "../scripts/vinext-shim-proxy.ts";

const path = "workspaces/TECGRAF/strata-dlis/node_modules/.pnpm/vinext@1.0.0-beta.5_react/node_modules/vinext/dist/shims";

test("repairs missing root slash for generated Vinext RSC exports and imports", () => {
  const input = `export * from "${path}/default-global-error.js";\nimport * as __all__ from '${path}/layout-segment-context.js';`;
  const result = rewriteVinextShimProxy(input);
  assert.equal(result, `export * from "/${path}/default-global-error.js";\nimport * as __all__ from '/${path}/layout-segment-context.js';`);
});

test("keeps already absolute and unrelated imports unchanged", () => {
  const code = `export * from "/${path}/slot.js";\nimport "./local.js";\nexport * from "vinext/shims/error-boundary";`;
  assert.equal(rewriteVinextShimProxy(code), code);
});

test("does not change application modules, packages or ambiguous paths", () => {
  const code = `import x from "workspaces/foo/other-package/index.js";\nimport y from "workspaces/foo/node_modules/vinext/dist/other.js";`;
  assert.equal(rewriteVinextShimProxy(code), code);
});
