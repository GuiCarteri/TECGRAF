import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const locales = ["pt-BR", "en", "zh-CN", "es"];
const dictionaries = Object.fromEntries(
  locales.map((l) => [
    l,
    JSON.parse(
      readFileSync(new URL("../lib/i18n/" + l + ".json", import.meta.url)),
    ),
  ]),
);
test("four dictionaries have identical keys and interpolation variables", () => {
  const keys = Object.keys(dictionaries["pt-BR"]).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(dictionaries[locale]).sort(), keys);
    for (const key of keys) {
      const text = dictionaries[locale][key];
      assert.ok(text.trim(), locale + ": " + key);
      assert.deepEqual(
        (text.match(/\{\w+\}/g) || []).sort(),
        (dictionaries["pt-BR"][key].match(/\{\w+\}/g) || []).sort(),
        key,
      );
    }
  }
});
test("application has no operational legacy auth integration", () => {
  for (const folder of ["app", "components", "lib", "scripts"])
    for (const file of readdirSync(folder, { recursive: true }).filter(
      (x) => /\.(tsx?|mjs|js|json)$/.test(x) && !x.startsWith("vendor/"),
    )) {
      const source = readFileSync(folder + "/" + file, "utf8");
      assert.doesNotMatch(
        source,
        /signin-with-chatgpt|signout-with-chatgpt|oai-authenticated-user|AUTH_MODE|\.openai\/hosting|sites-vite-plugin/,
        folder + "/" + file,
      );
    }
});
test("parser, technical classification and export implementation preserved byte for byte", () => {
  const manifest = JSON.parse(
    readFileSync("tests/technical-integrity.json", "utf8"),
  );
  return import("node:crypto").then(({ createHash }) => {
    for (const [file, hash] of Object.entries(manifest))
      assert.equal(
        createHash("sha256").update(readFileSync(file)).digest("hex"),
        hash,
        file,
      );
  });
});
