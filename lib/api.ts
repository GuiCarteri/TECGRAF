export async function api(path: string, init?: RequestInit) {
  let r = await fetch("/api/" + path, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  if (r.status === 401 && !path.startsWith("auth/")) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
    if (refreshed.ok)
      r = await fetch("/api/" + path, {
        ...init,
        headers: {
          ...(init?.body && typeof init.body === "string"
            ? { "Content-Type": "application/json" }
            : {}),
          ...init?.headers,
        },
      });
  }
  const data: any = await r.json();
  if (!r.ok)
    throw new Error(
      data.error || "Não foi possível concluir. Tente novamente.",
    );
  return data;
}
export const post = (path: string, data: unknown) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export const formatBytes = (n: number) =>
  n < 1048576
    ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1048576).toFixed(1)} MB`;
