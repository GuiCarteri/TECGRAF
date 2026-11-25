import type { UserProfile } from "../api-types";
import { env } from "cloudflare:workers";
import { providerUser } from "./provider";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
import { query } from "./db";
export async function currentUser() {
  const identity = await providerUser();
  if (!identity) return null;
  const admins = String(env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim());
  const isAdmin =
    identity.userId.startsWith("supabase:") &&
    admins.includes(identity.userId.slice(9));
  await query(
    "INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name",
    identity.userId,
    identity.email,
    identity.displayName,
    isAdmin ? "admin" : "user",
    new Date().toISOString(),
  ).run();
  return await query(
    "SELECT * FROM users WHERE id=?",
    identity.userId,
  ).first<UserProfile>();
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
  const referer = request.headers.get("referer");
  if (
    !origin &&
    referer &&
    URL.parse(referer)?.origin !== new URL(request.url).origin
  )
    throw new HttpError("Origem não autorizada.", 403);
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || (!origin && !referer && site === "same-site"))
    throw new HttpError("Requisição externa não autorizada.", 403);
}
