import { z } from "zod";
import { locales, themes } from "@/lib/i18n";
import { sameOrigin, HttpError } from "@/lib/server/auth";
import { savePreferences } from "@/lib/server/preferences";

const schema = z
  .object({
    locale: z.enum(locales).optional(),
    theme: z.enum(themes).optional(),
  })
  .strict()
  .refine((value) => value.locale || value.theme);

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return new Response(null, { status: 415 });
    const settings = schema.safeParse(await request.json().catch(() => null));
    if (!settings.success) return new Response(null, { status: 400 });
    if (!(await savePreferences(settings.data)))
      return new Response(null, { status: 401 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(null, {
      status: error instanceof HttpError ? error.status : 503,
    });
  }
}
