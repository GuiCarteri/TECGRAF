let refreshing: Promise<boolean> | null = null;
async function refresh() {
  if (!refreshing)
    refreshing = fetch("/api/auth/refresh", { method: "POST" })
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
export async function api(path: string, init?: RequestInit) {
  const r = await authenticatedFetch("/api/" + path, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (!r.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "UNKNOWN_ERROR",
    );
  return data;
}
export const post = (path: string, data: unknown) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export const formatBytes = (n: number, locale = "pt-BR") =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / (n < 1048576 ? 1024 : 1048576)) + (n < 1048576 ? " KB" : " MB");
