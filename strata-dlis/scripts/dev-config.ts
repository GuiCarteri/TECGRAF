/** Only this Codespace's forwarded origin is allowed, never all external hosts. */
export function codespaceHost(env: Record<string, string | undefined>) {
  if (env.CODESPACES !== "true") return undefined;
  const name = env.CODESPACE_NAME;
  const domain =
    env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
  if (!name || !/^[a-z0-9-]+$/.test(name) || !/^[a-z0-9.-]+$/.test(domain))
    return undefined;
  return `${name}-5173.${domain}`;
}
