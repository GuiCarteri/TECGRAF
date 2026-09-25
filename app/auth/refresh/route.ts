import {
  refreshSession,
  clearSession,
  safeNext,
  authMode,
} from "@/lib/server/provider";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url),
    next = safeNext(url.searchParams.get("next") || "/account");
  if (authMode() !== "supabase")
    return Response.redirect(new URL("/login", url), 303);
  try {
    await refreshSession(url.protocol === "https:");
    return Response.redirect(new URL(next, url), 303);
  } catch {
    await clearSession();
    return Response.redirect(
      new URL("/login?next=" + encodeURIComponent(next), url),
      303,
    );
  }
}
