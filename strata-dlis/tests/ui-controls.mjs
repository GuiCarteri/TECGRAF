// Optional DOM runner, like PLAYWRIGHT_MODULE: no server or external auth is used.
import { MessageChannel } from "node:worker_threads";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.JSDOM_MODULE || "jsdom");
const viteRequire = createRequire(import.meta.resolve("vite"));
const { build } = viteRequire("esbuild");
const result = await build({
  entryPoints: ["tests/ui-controls-entry.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
});
const dom = new JSDOM(
  '<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>',
  {
    url: "https://strata.test/login",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  },
);
const { window } = dom;
const channels = [];
window.MessageChannel = class extends MessageChannel {
  constructor() {
    super();
    channels.push(this);
  }
};
const requests = [];
window.fetch = async (url, init) => {
  if (url === "/api/auth/config")
    return { ok: true, json: async () => ({ configured: true }) };
  requests.push({ url, body: JSON.parse(init.body) });
  return {
    ok: false,
    json: async () => ({ error: "AUTH_INVALID_CREDENTIALS" }),
  };
};
try {
  window.eval(result.outputFiles[0].text);
  const { act, mount } = window.strataTest;
  await mount();
  const doc = window.document;
  const select = doc.querySelector("select");
  const input = (type, text) => {
    const element = doc.querySelector(`input[type=${type}]`);
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set.call(element, text);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  await act(async () => {
    input("email", "person@example.test");
    input("password", "short1");
  });
  async function language(locale) {
    await act(async () => {
      select.value = locale;
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(doc.documentElement.lang, locale);
    assert.equal(doc.querySelector("#active-locale").textContent, locale);
    assert.equal(
      doc.querySelector("input[type=email]").value,
      "person@example.test",
    );
    assert.equal(doc.querySelector("input[type=password]").value, "short1");
  }
  for (const locale of ["en", "es", "zh-CN", "pt-BR"]) {
    await language(locale);
    assert.match(doc.cookie, new RegExp(`strata_locale=${locale}`));
  }
  const apply = new window.Event("submit", { bubbles: true, cancelable: true });
  await act(async () => {
    doc.querySelector(".language-selector").dispatchEvent(apply);
  });
  assert.equal(
    apply.defaultPrevented,
    true,
    "Apply must preserve local file/form state without navigation",
  );
  await act(async () => {
    doc
      .querySelector("form.stack")
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/auth/login");
  assert.equal(requests[0].body.password, "short1");
  assert.equal(requests[0].body.email, "person@example.test");
  assert.match(
    doc.querySelector("[role=alert]").textContent,
    /E-mail ou senha inválidos/,
  );
  Object.defineProperty(doc, "cookie", {
    configurable: true,
    get() {
      return "";
    },
    set() {
      throw new Error("Cookies blocked");
    },
  });
  await language("en");
  assert.equal(window.location.href, "https://strata.test/login");
  window.strataTest.unmount();
  console.log(
    "PASS: React language changes, Apply without reload, preserved inputs, login submission/errors and blocked-cookie handling (DOM emulation)",
  );
} finally {
  for (const channel of channels) {
    channel.port1.close();
    channel.port2.close();
  }
  window.close();
}
