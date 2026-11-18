import { languageSwitchResponse } from "@/lib/i18n/switch";

/**
 * GET form fallback allows language switching even if the Vinext/RSC
 * browser bundle fails to hydrate. No login or JavaScript is required.
 */
export function GET(request: Request): Response {
  return languageSwitchResponse(request);
}
