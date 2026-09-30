"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useState, useEffect } from "react";
import { safeNext } from "@/lib/auth-policy";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
type FormMode =
  "login" | "register" | "recover" | "verify" | "change-password" | "resend";
type AuthResult = { error?: string; verify?: boolean; message?: string };
export function EmailForm({
  initial = "login",
  next = "/account",
}: {
  initial?: string;
  next?: string;
}) {
  const { translate, message: localizeMessage } = useI18n();
  const [mode, setMode] = useState<FormMode>(
      initial === "register" ? "register" : "login",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [token, setToken] = useState(""),
    [verifyType, setVerifyType] = useState("signup"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((d) => {
        setConfigured(d.configured);
        if (!d.configured) setError("AUTH_NOT_CONFIGURED");
      })
      .catch(() => {
        setConfigured(false);
        setError("NETWORK_ERROR");
      });
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          token,
          type: verifyType,
        }),
      });
      const d = (await r.json()) as AuthResult;
      if (!r.ok) throw new Error(d.error);
      if (mode === "resend") {
        setVerifyType("signup");
        setMode("verify");
        setMessage(d.message || "");
      } else if (mode === "recover") {
        setVerifyType("recovery");
        setMode("verify");
        setMessage(d.message || "");
      } else if (mode === "register" && d.verify) {
        setVerifyType("signup");
        setMode("verify");
        setMessage(d.message || "");
      } else if (mode === "verify" && verifyType === "recovery") {
        setMode("change-password");
        setMessage("Código confirmado. Defina sua nova senha.");
        setPassword("");
      } else {
        window.location.assign(safeNext(next));
      }
    } catch (e: unknown) {
      setError(
        e instanceof TypeError
          ? "NETWORK_ERROR"
          : e instanceof Error
            ? e.message
            : "AUTH_FAILED",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack">
      <h1>
        {
          (
            {
              resend: translate("Confirme seu e-mail"),
              login: translate("Entre no STRATA"),
              register: translate("Crie sua conta"),
              recover: translate("Recuperar acesso"),
              verify: translate("Confirme seu e-mail"),
              "change-password": translate("Nova senha"),
            } as Record<FormMode, string>
          )[mode]
        }
      </h1>
      {error && (
        <div className="notice error" role="alert">
          {localizeMessage(error)}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {localizeMessage(message)}
        </div>
      )}
      {mode === "register" && (
        <label className="form-field">
          {translate("Nome")}
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
      )}
      <label className="form-field">
        {translate("E-mail")}
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          readOnly={mode === "verify" || mode === "change-password"}
        />
      </label>
      {["login", "register", "change-password"].includes(mode) && (
        <label className="form-field">
          {translate("Senha")}
          <input
            required
            type="password"
            minLength={8}
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>
      )}
      {mode === "verify" && (
        <label className="form-field">
          {translate("Código recebido por e-mail")}
          <InputOTP
            required
            maxLength={6}
            pattern="^[0-9]*$"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={token}
            onChange={setToken}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </label>
      )}
      <button className="button primary" disabled={busy || configured !== true}>
        {busy
          ? translate("Aguarde…")
          : (
              {
                resend: translate("Enviar código"),
                login: translate("Entrar"),
                register: translate("Criar conta"),
                recover: translate("Enviar código"),
                verify: translate("Confirmar código"),
                "change-password": translate("Salvar nova senha"),
              } as Record<FormMode, string>
            )[mode]}
      </button>
      {mode === "verify" && (
        <button
          type="button"
          className="status-label"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch(
                "/api/auth/" +
                  (verifyType === "recovery" ? "recover" : "resend"),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                },
              );
              const d = (await r.json()) as { error?: string; message: string };
              if (!r.ok) throw new Error(d.error);
              setMessage(d.message || "");
              setToken("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "AUTH_FAILED");
            } finally {
              setBusy(false);
            }
          }}
        >
          {translate("resend_code")}
        </button>
      )}
      <div className="row">
        {mode === "login" ? (
          <>
            <button
              type="button"
              className="status-label"
              onClick={() => setMode("register")}
            >
              {translate("Criar conta")}
            </button>
            <button
              type="button"
              className="status-label"
              onClick={() => {
                setVerifyType("signup");
                setMode("resend");
                setError("");
                setMessage("");
              }}
            >
              {translate("confirm_email_again")}
            </button>
            <button
              type="button"
              className="status-label"
              onClick={() => setMode("recover")}
            >
              {translate("Esqueci minha senha")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="status-label"
            onClick={() => {
              setMode("login");
              setMessage("");
              setError("");
            }}
          >
            {translate("Voltar ao login")}
          </button>
        )}
      </div>
    </form>
  );
}
