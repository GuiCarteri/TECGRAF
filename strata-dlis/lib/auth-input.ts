const loginErrors = new Set([
  "AUTH_NOT_CONFIGURED",
  "AUTH_UNAVAILABLE",
  "AUTH_FAILED",
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_EMAIL_UNCONFIRMED",
  "AUTH_RATE_LIMIT",
  "AUTH_EXPIRED",
  "NETWORK_ERROR",
]);
export function loginError(value?: string) {
  return value && loginErrors.has(value) ? value : "";
}
export function authConfig(url: unknown, key: unknown) {
  const supabaseUrl =
    typeof url === "string" ? url.trim().replace(/\/$/, "") : "";
  const supabaseKey = typeof key === "string" ? key.trim() : "";
  let configured = false;
  try {
    const parsed = new URL(supabaseUrl);
    configured =
      parsed.protocol === "https:" &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.username &&
      !parsed.password &&
      !/YOUR_PROJECT/i.test(parsed.hostname) &&
      !!supabaseKey;
  } catch {
    /* Invalid or missing configuration stays disabled. */
  }
  return { url: supabaseUrl, key: supabaseKey, configured };
}
