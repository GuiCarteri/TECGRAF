let refreshing: Promise<boolean> | null = null;
async function refresh() {
  if (!refreshing)
    refreshing = fetch("/api/auth/refresh", { method: "POST", signal: AbortSignal.timeout(15000) })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export async function authenticatedFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
    if (
      response.status === 401 &&
      !url.startsWith("/api/auth/") &&
      (await refresh())
    )
      response = await fetch(url, init);
  } catch {
    throw new Error("NETWORK_ERROR");
  }
  return response;
}
export async function api<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const r = await authenticatedFetch("/api/" + path, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const data: unknown = await r.json().catch(() => null);
  if (!r.ok)
    throw new Error(
      data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "UNKNOWN_ERROR",
    );
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Dados inválidos.");
  if (
    typeof window !== "undefined" &&
    window.BroadcastChannel &&
    (((path === "admin/files" || path.endsWith("/reindex")) &&
      init?.method === "POST") ||
      (path.startsWith("files/") && init?.method === "DELETE"))
  ) {
    const channel = new BroadcastChannel("strata-catalog");
    channel.postMessage("refresh");
    channel.close();
  }
  return data as T;
}
export const post = <T = Record<string, unknown>>(
  path: string,
  data: unknown,
) => api<T>(path, { method: "POST", body: JSON.stringify(data) });
export const formatBytes = (n: number, locale = "pt-BR") =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / (n < 1048576 ? 1024 : 1048576)) + (n < 1048576 ? " KB" : " MB");
