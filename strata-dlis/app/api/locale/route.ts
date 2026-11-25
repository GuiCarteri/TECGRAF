import { sameOrigin, HttpError } from "@/lib/server/auth";
import { savePreferences } from "@/lib/server/preferences";
import { locales, type Locale } from "@/lib/i18n";
import { languageSwitchResponse } from "@/lib/i18n/switch";

/**
 * GET form fallback allows language switching even if the Vinext/RSC
 * browser bundle fails to hydrate. No login or JavaScript is required.
 */
export function GET(request: Request): Response {
  return languageSwitchResponse(request);
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const value = (await request.formData()).get("lang");
    if (typeof value !== "string" || !locales.includes(value as Locale))
      return new Response(null, { status: 400 });
    const url = new URL(request.url);
    url.searchParams.set("lang", value);
    await savePreferences({ locale: value as Locale });
    return languageSwitchResponse(
      new Request(url, { headers: request.headers }),
    );
  } catch (error) {
    return new Response(null, {
      status: error instanceof HttpError ? error.status : 503,
    });
  }
}
