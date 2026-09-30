import { redirect } from "next/navigation";
import {
  providerUser,
  providerConfigured,
  hasRefresh,
  safeNext,
} from "./provider";
export async function requireIdentity(returnTo: string) {
  const next = safeNext(returnTo);
  if (!providerConfigured())
    redirect("/login?next=" + encodeURIComponent(next));
  const user = await providerUser();
  if (user) return user;
  if (await hasRefresh())
    redirect("/auth/refresh?next=" + encodeURIComponent(next));
  redirect("/login?next=" + encodeURIComponent(next));
}
