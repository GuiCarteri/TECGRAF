/** Server-side fallback for switching languages when client hydration fails. */
const SUPPORTED = new Set(["pt-BR", "en", "zh-CN", "es"]);

/** The response uses a relative Location, so it cannot redirect off-site. */
export function languageSwitchResponse(request: Request): Response {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang");
  if (!lang || !SUPPORTED.has(lang)) {
    return new Response("Unsupported language", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let destination = "/";
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const previous = new URL(referer);
      if (
        previous.origin === url.origin &&
        previous.pathname !== "/api/locale" &&
        !previous.pathname.startsWith("//")
      ) {
        destination = previous.pathname + previous.search;
      }
    } catch {
      // Missing or malformed Referer: return to the public homepage.
    }
  }

  const secure = url.protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination,
      "Set-Cookie": `strata_locale=${lang}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`,
      "Cache-Control": "no-store",
    },
  });
}
