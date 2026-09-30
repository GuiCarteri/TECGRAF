/** Accept only local application destinations; never enter an authentication loop. */
export function safeNext(value: string): string {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/account";
  try {
    const u = new URL(value, "https://strata.invalid");
    if (
      u.origin !== "https://strata.invalid" ||
      /^\/(auth|api|login|register)(\/|$)/.test(u.pathname)
    )
      return "/account";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/account";
  }
}
