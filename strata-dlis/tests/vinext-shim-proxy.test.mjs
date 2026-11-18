import test from "node:test";
import assert from "node:assert/strict";
import { rewriteVinextShimProxy } from "../scripts/vinext-shim-proxy.ts";

const path = "workspaces/TECGRAF/strata-dlis/node_modules/.pnpm/vinext@1.0.0-beta.5_react/node_modules/vinext/dist/shims";

test("rewrites broken virtual proxy imports to public Vinext subpaths", () => {
  const input = `export * from "${path}/default-global-error.js";\nimport * as __all__ from '/${path}/layout-segment-context.js';`;
  const result = rewriteVinextShimProxy(input);
  assert.equal(result, 'export * from "vinext/shims/default-global-error";\nimport * as __all__ from \'vinext/shims/layout-segment-context\';');
});

test("leaves unrelated application imports and public shim specifiers untouched", () => {
  const code = 'import "./local.js";\nexport * from "vinext/shims/error-boundary";';
  assert.equal(rewriteVinextShimProxy(code), code);
});

test("does not rewrite unrelated package or Vinext paths", () => {
  const code = 'import x from "workspaces/foo/other-package/index.js";\nimport y from "workspaces/foo/node_modules/vinext/dist/other.js";';
  assert.equal(rewriteVinextShimProxy(code), code);
});
