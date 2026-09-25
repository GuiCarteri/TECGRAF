"use client";
import { useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
export function EmailForm({
  initial = "login",
  next = "/account",
}: {
  initial?: string;
  next?: string;
}) {
  const [mode, setMode] = useState(initial),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [token, setToken] = useState(""),
    [verifyType, setVerifyType] = useState("signup"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
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
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (mode === "recover") {
        setVerifyType("recovery");
        setMode("verify");
        setMessage(d.message);
      } else if (mode === "register" && d.verify) {
        setVerifyType("signup");
        setMode("verify");
        setMessage(d.message);
      } else if (mode === "verify" && verifyType === "recovery") {
        setMode("change-password");
        setMessage("Código confirmado. Defina sua nova senha.");
        setPassword("");
      } else {
        window.location.assign(
          next.startsWith("/") && !next.startsWith("//") ? next : "/account",
        );
      }
    } catch (e: any) {
      setError(e.message);
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
              login: "Entre no STRATA",
              register: "Crie sua conta",
              recover: "Recuperar acesso",
              verify: "Confirme seu e-mail",
              "change-password": "Nova senha",
            } as any
          )[mode]
        }
      </h1>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {mode === "register" && (
        <label className="form-field">
          Nome
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
      )}
      <label className="form-field">
        E-mail
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
          Senha
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
          Código recebido por e-mail
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
      <button className="button primary" disabled={busy}>
        {busy
          ? "Aguarde…"
          : (
              {
                login: "Entrar",
                register: "Criar conta",
                recover: "Enviar código",
                verify: "Confirmar código",
                "change-password": "Salvar nova senha",
              } as any
            )[mode]}
      </button>
      <div className="row">
        {mode === "login" ? (
          <>
            <button
              type="button"
              className="status-label"
              onClick={() => setMode("register")}
            >
              Criar conta
            </button>
            <button
              type="button"
              className="status-label"
              onClick={() => setMode("recover")}
            >
              Esqueci minha senha
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
            Voltar ao login
          </button>
        )}
      </div>
    </form>
  );
}
