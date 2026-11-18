import { loginError } from "../auth-input";
import { validPasswordLength } from "../auth-policy";
import { safeNext } from "../auth-policy";
import { cookies } from "next/headers";
import {
  providerConfigured,
  providerRequest,
  writeSession,
  clearSession,
  refreshSession,
} from "./provider";
import { sameOrigin, HttpError } from "./auth";
export async function authHandler(request: Request, action: string) {
  const native =
    action === "login" &&
    request.headers.get("content-type")?.split(";")[0] ===
      "application/x-www-form-urlencoded";
  let next = "/account";
  try {
    if (action === "config" && request.method === "GET")
      return Response.json(
        { configured: providerConfigured() },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (!providerConfigured()) throw new HttpError("AUTH_NOT_CONFIGURED", 503);
    if (request.method !== "POST")
      return Response.json({ error: "Método não permitido." }, { status: 405 });
    sameOrigin(request);
    const secure = new URL(request.url).protocol === "https:";
    if (action === "refresh") {
      await refreshSession(secure);
      return Response.json({ ok: true });
    }
    if (action === "logout") {
      const token = (await cookies()).get("strata_access")?.value;
      if (token) await providerRequest("logout", {}, token).catch(() => {});
      await clearSession();
      return Response.json({ ok: true });
    }
    const text = await request.text();
    if (text.length > 6000) throw new HttpError("Formulário inválido.");
    const b = native
      ? Object.fromEntries(new URLSearchParams(text))
      : JSON.parse(text || "{}");
    if (!b || typeof b !== "object" || Array.isArray(b))
      throw new HttpError("Dados inválidos.");
    next = safeNext(typeof b.next === "string" ? b.next : "/account");
    const email = String(b.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new HttpError("Informe um e-mail válido.");
    if (
      (action === "login" || action === "register" || action === "change-password") &&
      !validPasswordLength(action, b.password)
    )
      throw new HttpError(
        action === "login"
          ? "AUTH_INVALID_CREDENTIALS"
          : "Use uma senha de 8 a 200 caracteres.",
      );
    if (action === "login") {
      await writeSession(
        await providerRequest("token?grant_type=password", {
          email,
          password: b.password,
        }),
        secure,
      );
      return native
        ? new Response(null, {
            status: 303,
            headers: { Location: next, "Cache-Control": "no-store" },
          })
        : Response.json({ ok: true });
    }
    if (action === "register") {
      const d = await providerRequest("signup", {
        email,
        password: b.password,
        data: { name: String(b.name || "").slice(0, 100) },
      });
      if (d.access_token) {
        await writeSession(d, secure);
        return Response.json({ ok: true, session: true });
      }
      return Response.json({
        ok: true,
        verify: true,
        message:
          "Se o endereço puder ser cadastrado, você receberá um código de confirmação.",
      });
    }
    if (action === "resend") {
      await providerRequest("resend", { type: "signup", email });
      return Response.json({
        ok: true,
        message:
          "Se o endereço puder ser cadastrado, você receberá um código de confirmação.",
      });
    }
    if (action === "recover") {
      await providerRequest("recover", { email });
      return Response.json({
        ok: true,
        message:
          "Se houver uma conta para este e-mail, enviaremos um código de recuperação.",
      });
    }
    if (action === "verify") {
      if (
        !["signup", "recovery"].includes(b.type) ||
        !/^\d{6,10}$/.test(b.token)
      )
        throw new HttpError("Código de confirmação inválido.");
      const d = await providerRequest("verify", {
        email,
        token: b.token,
        type: b.type,
      });
      await writeSession(d, secure);
      return Response.json({ ok: true });
    }
    if (action === "change-password") {
      const token = (await cookies()).get("strata_access")?.value;
      if (!token)
        throw new HttpError("Confirme o código de recuperação primeiro.", 401);
      const current = await providerRequest("user", undefined, token);
      if (current.email?.toLowerCase() !== email.toLowerCase())
        throw new HttpError("Conta diferente da recuperação.", 403);
      await providerRequest("user", { password: b.password }, token, "PUT");
      return Response.json({ ok: true });
    }
    throw new HttpError("Ação não encontrada.", 404);
  } catch (e: unknown) {
    if (native) {
      const code =
        loginError(e instanceof HttpError ? e.message : "") || "AUTH_FAILED";
      return new Response(null, {
        status: 303,
        headers: {
          Location:
            "/login?" + new URLSearchParams({ error: code, next }).toString(),
          "Cache-Control": "no-store",
        },
      });
    }
    if (action === "refresh" && e instanceof HttpError && e.status < 500)
      await clearSession();
    return Response.json(
      { error: e instanceof HttpError ? e.message : "AUTH_FAILED" },
      {
        status: e instanceof HttpError ? e.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
