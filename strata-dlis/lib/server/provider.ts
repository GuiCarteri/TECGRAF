import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { HttpError } from "./errors";
import { safeNext } from "../auth-policy";
export { safeNext };
export type Identity = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};
type ProviderUser = {
  id?: string;
  email?: string;
  email_confirmed_at?: string;
  user_metadata?: { name?: string };
};
export type ProviderResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: ProviderUser;
} & ProviderUser;
const options = { httpOnly: true, sameSite: "lax" as const, path: "/" };
export function providerConfigured() {
  return (
    /^https:\/\/[^/]+$/.test(
      String(env.SUPABASE_URL || "").replace(/\/$/, ""),
    ) && !!env.SUPABASE_ANON_KEY
  );
}
export async function providerRequest(
  path: string,
  body?: unknown,
  token?: string,
  method?: string,
): Promise<ProviderResponse> {
  if (!providerConfigured()) throw new HttpError("AUTH_NOT_CONFIGURED", 503);
  let response: Response;
  try {
    response = await fetch(
      String(env.SUPABASE_URL).replace(/\/$/, "") + "/auth/v1/" + path,
      {
        method: method || (body ? "POST" : "GET"),
        headers: {
          apikey: env.SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw new HttpError("AUTH_UNAVAILABLE", 503);
  }
  const data = (await response.json().catch(() => ({}))) as ProviderResponse & {
    code?: string;
    error_code?: string;
  };
  if (!response.ok) {
    const code = data.code || data.error_code;
    const mapped: Record<string, string> = {
      invalid_credentials: "AUTH_INVALID_CREDENTIALS",
      email_not_confirmed: "AUTH_EMAIL_UNCONFIRMED",
      otp_expired: "AUTH_INVALID_CODE",
      over_email_send_rate_limit: "AUTH_RATE_LIMIT",
      over_request_rate_limit: "AUTH_RATE_LIMIT",
      weak_password: "AUTH_PASSWORD_INVALID",
      session_not_found: "AUTH_EXPIRED",
      refresh_token_not_found: "AUTH_EXPIRED",
      refresh_token_already_used: "AUTH_EXPIRED",
    };
    throw new HttpError(
      mapped[code || ""] ||
        (response.status === 429 ? "AUTH_RATE_LIMIT" : "AUTH_FAILED"),
      response.status >= 500 ? 503 : response.status,
    );
  }
  return data;
}
export async function providerUser(): Promise<Identity | null> {
  if (!providerConfigured()) throw new HttpError("AUTH_NOT_CONFIGURED", 503);
  const token = (await cookies()).get("strata_access")?.value;
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
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) return null;
    throw error;
  }
}
export async function writeSession(data: ProviderResponse, secure: boolean) {
  if (
    !data.access_token ||
    !data.refresh_token ||
    !data.user?.email_confirmed_at
  )
    throw new HttpError("AUTH_EMAIL_UNCONFIRMED", 401);
  const c = await cookies();
  c.set("strata_access", data.access_token, {
    ...options,
    secure,
    maxAge: Math.max(1, data.expires_in || 3600),
  });
  c.set("strata_refresh", data.refresh_token, {
    ...options,
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
  if (!token) throw new HttpError("AUTH_EXPIRED", 401);
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
