// Optional portable provider. Native Sites continues to use dispatch-owned SIWC.
// Supabase owns passwords, verification, recovery and refresh-token rotation.
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
export const authMode = () => String((env as any).AUTH_MODE || "chatgpt");
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/" };
export async function providerRequest(
  path: string,
  body?: any,
  token?: string,
  method?: string,
) {
  const url = String((env as any).SUPABASE_URL || "").replace(/\/$/, ""),
    key = String((env as any).SUPABASE_ANON_KEY || "");
  if (!url.startsWith("https://") || !key)
    throw new Error("Configure SUPABASE_URL e SUPABASE_ANON_KEY no servidor.");
  const r = await fetch(url + "/auth/v1/" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e: any = new Error(
      "Não foi possível autenticar. Confira os dados, a confirmação de e-mail ou tente novamente em instantes.",
    );
    e.status = r.status;
    throw e;
  }
  return d;
}
export async function providerUser() {
  const c = await cookies(),
    token = c.get("strata_access")?.value;
  if (!token) return null;
  try {
    const u = await providerRequest("user", undefined, token);
    if (!u.id || !u.email || !u.email_confirmed_at) return null;
    return {
      userId: "supabase:" + u.id,
      email: u.email,
      displayName: u.user_metadata?.name || u.email,
      fullName: u.user_metadata?.name || null,
    };
  } catch {
    return null;
  }
}
export async function writeSession(data: any, secure: boolean) {
  if (!data.access_token || !data.refresh_token)
    throw new Error("A conta precisa ser confirmada por e-mail.");
  const c = await cookies();
  c.set("strata_access", data.access_token, {
    ...cookieOptions,
    secure,
    maxAge: data.expires_in || 3600,
  });
  c.set("strata_refresh", data.refresh_token, {
    ...cookieOptions,
    secure,
    maxAge: 30 * 24 * 3600,
  });
}
export async function clearSession() {
  const c = await cookies();
  c.delete("strata_access");
  c.delete("strata_refresh");
}
export async function refreshSession(secure: boolean) {
  const token = (await cookies()).get("strata_refresh")?.value;
  if (!token) throw new Error("Entre novamente na sua conta.");
  await writeSession(
    await providerRequest("token?grant_type=refresh_token", {
      refresh_token: token,
    }),
    secure,
  );
}
export async function hasRefresh() {
  return !!(await cookies()).get("strata_refresh")?.value;
}
export function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/account";
  const u = new URL(value, "https://strata.invalid");
  return u.origin === "https://strata.invalid"
    ? u.pathname + u.search
    : "/account";
}
