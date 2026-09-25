import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { query } from "./db";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function currentUser() {
  const identity = await getChatGPTUser();
  if (!identity) return null;
  const admins = String((env as any).ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim());
  const isAdmin = admins.includes(identity.email.toLowerCase());
  await query(
    "INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name",
    identity.userId,
    identity.email,
    identity.displayName,
    isAdmin ? "admin" : "user",
    new Date().toISOString(),
  ).run();
  if (isAdmin)
    await query(
      "UPDATE users SET role='admin' WHERE id=?",
      identity.userId,
    ).run();
  return await query(
    "SELECT * FROM users WHERE id=?",
    identity.userId,
  ).first<any>();
}
export async function requireUser(roles?: string[]) {
  const user = await currentUser();
  if (!user) throw new HttpError("Entre na sua conta para continuar.", 401);
  if (roles && !roles.includes(user.role))
    throw new HttpError("Sua conta não tem permissão para esta ação.", 403);
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError("Origem não autorizada.", 403);
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site")
    throw new HttpError("Requisição externa não autorizada.", 403);
}
