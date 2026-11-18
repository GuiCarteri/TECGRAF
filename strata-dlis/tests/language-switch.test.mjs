import test from "node:test";
import assert from "node:assert/strict";
import { languageSwitchResponse } from "../lib/i18n/switch.ts";

test("native language fallback sets locale and preserves same-origin path", () => {
  const request = new Request("https://strata.example/api/locale?lang=en", {
    headers: { referer: "https://strata.example/viewer?file=123" },
  });
  const response = languageSwitchResponse(request);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/viewer?file=123");
  assert.match(response.headers.get("set-cookie") || "", /strata_locale=en;/);
  assert.match(response.headers.get("set-cookie") || "", /Secure/);
});

test("language switching works for all supported locales", () => {
  for (const lang of ["pt-BR", "en", "zh-CN", "es"]) {
    const response = languageSwitchResponse(
      new Request(`http://localhost:5173/api/locale?lang=${lang}`),
    );
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/");
    assert.ok(
      response.headers.get("set-cookie")?.includes(`strata_locale=${lang}`),
    );
    assert.doesNotMatch(response.headers.get("set-cookie") || "", /Secure/);
  }
});

test("disallows unknown languages and external redirect destinations", () => {
  const bad = languageSwitchResponse(
    new Request("https://strata.example/api/locale?lang=evil"),
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("set-cookie"), null);
  const safe = languageSwitchResponse(
    new Request("https://strata.example/api/locale?lang=es", {
      headers: { referer: "https://malicious.example/steal" },
    }),
  );
  assert.equal(safe.headers.get("location"), "/");
});

test("same-origin Referer cannot become a protocol-relative redirect", () => {
  const response = languageSwitchResponse(
    new Request("https://strata.example/api/locale?lang=en", {
      headers: { referer: "https://strata.example//evil.test" },
    }),
  );
  assert.equal(response.headers.get("location"), "/");
});
