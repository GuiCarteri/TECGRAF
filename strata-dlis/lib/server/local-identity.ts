import { argon2idAsync } from "@noble/hashes/argon2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { timingSafeEqual } from "node:crypto";
import { database, query } from "./db";
import { HttpError } from "./errors";
import type { ProviderResponse } from "./provider";

type Account = {
  id: string;
  email: string;
  name: string;
  confirmed_at: string | null;
  password_hash: string;
};
type Input = {
  email?: string;
  password?: string;
  refresh_token?: string;
  token?: string;
  type?: string;
  data?: { name?: string };
};
const randomHex = (size: number) =>
  bytesToHex(crypto.getRandomValues(new Uint8Array(size)));
const digest = async (value: string) =>
  bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
const accessLifetime = 3600;
const now = () => Math.floor(Date.now() / 1000);
const expired = () => new HttpError("AUTH_EXPIRED", 401);
const user = (a: Account) => ({
  id: a.id,
  email: a.email,
  user_metadata: { name: a.name },
  email_confirmed_at: a.confirmed_at ?? undefined,
});
async function derive(password: string, salt: string) {
  return argon2idAsync(password, hexToBytes(salt), {
    m: 19456,
    t: 2,
    p: 1,
    dkLen: 32,
  });
}
async function passwordHash(password: string) {
  const salt = randomHex(16);
  return [
    "argon2id-v19-m19456-t2-p1",
    salt,
    bytesToHex(await derive(password, salt)),
  ].join("$");
}
async function matches(password: string, stored?: string) {
  const [, salt, expected] = stored?.split("$") ?? [];
  const actual = await derive(password, salt || "00".repeat(16));
  return !!expected && timingSafeEqual(actual, hexToBytes(expected));
}
async function tokenPair() {
  const access = randomHex(32),
    refresh = randomHex(32);
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: accessLifetime,
    accessHash: await digest(access),
    refreshHash: await digest(refresh),
  };
}
const session = (
  p: Awaited<ReturnType<typeof tokenPair>>,
  a: Account,
): ProviderResponse => ({
  access_token: p.access_token,
  refresh_token: p.refresh_token,
  expires_in: p.expires_in,
  user: user(a),
});
function mailStatement(email: string, purpose: string) {
  const code = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return query(
    "INSERT INTO local_mail(account_id,purpose,code,expires_at) SELECT id,?,?,? FROM local_accounts WHERE email=? AND (confirmed_at IS NULL)=? ON CONFLICT(account_id,purpose) DO UPDATE SET code=excluded.code,expires_at=excluded.expires_at",
    purpose,
    String(code).padStart(6, "0"),
    now() + 600,
    email,
    purpose === "signup" ? 1 : 0,
  );
}

export async function localRequest(
  path: string,
  raw?: unknown,
  token?: string,
  method?: string,
): Promise<ProviderResponse> {
  const b = (raw || {}) as Input;
  const email = b.email?.toLowerCase(),
    time = now();
  if (path === "logout") {
    await query(
      "DELETE FROM local_sessions WHERE access_hash=? OR refresh_hash=?",
      await digest(token || ""),
      await digest(b.refresh_token || ""),
    ).run();
    return {};
  }
  if (path === "user") {
    const access = await digest(token || "");
    const a = await query(
      "SELECT a.* FROM local_accounts a JOIN local_sessions s ON s.account_id=a.id WHERE s.access_hash=? AND s.access_until>? AND s.refresh_until>?",
      access,
      time,
      time,
    ).first<Account>();
    if (!a) throw expired();
    if (method === "PUT") {
      const hash = await passwordHash(b.password!);
      await database().batch([
        query(
          "UPDATE local_accounts SET password_hash=? WHERE id=?",
          hash,
          a.id,
        ),
        query(
          "DELETE FROM local_sessions WHERE account_id=? AND access_hash<>?",
          a.id,
          access,
        ),
        query("DELETE FROM local_mail WHERE account_id=?", a.id),
      ]);
    }
    return user(a);
  }
  if (path === "token?grant_type=refresh_token") {
    const pair = await tokenPair();
    const row = await query(
      "UPDATE local_sessions SET access_hash=?,refresh_hash=?,access_until=MIN(?,refresh_until) WHERE refresh_hash=? AND refresh_until>? RETURNING account_id",
      pair.accessHash,
      pair.refreshHash,
      time + accessLifetime,
      await digest(b.refresh_token || ""),
      time,
    ).first<{ account_id: string }>();
    if (!row) throw expired();
    const a = await query(
      "SELECT * FROM local_accounts WHERE id=?",
      row.account_id,
    ).first<Account>();
    if (!a) throw expired();
    return session(pair, a);
  }
  if (!email) throw new HttpError("AUTH_FAILED");
  const a = await query(
    "SELECT * FROM local_accounts WHERE email=?",
    email,
  ).first<Account>();
  if (path === "signup") {
    if (a?.confirmed_at) return {};
    const hash = await passwordHash(b.password!);
    const id = a?.id || crypto.randomUUID();
    await database().batch([
      query(
        "INSERT INTO local_accounts(id,email,name,password_hash) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash WHERE confirmed_at IS NULL",
        id,
        email,
        b.data?.name || "",
        hash,
      ),
      mailStatement(email, "signup"),
    ]);
    return {};
  }
  if (path === "resend" || path === "recover") {
    if (a && (path === "recover" ? a.confirmed_at : !a.confirmed_at))
      await mailStatement(
        email,
        path === "recover" ? "recovery" : "signup",
      ).run();
    return {};
  }
  if (path === "token?grant_type=password") {
    if (!(await matches(b.password!, a?.password_hash)) || !a)
      throw new HttpError("AUTH_INVALID_CREDENTIALS", 401);
    if (!a.confirmed_at) throw new HttpError("AUTH_EMAIL_UNCONFIRMED", 401);
    const pair = await tokenPair();
    const [result] = await database().batch([
      query(
        "INSERT INTO local_sessions SELECT ?,?,id,?,? FROM local_accounts WHERE id=? AND password_hash=?",
        pair.accessHash,
        pair.refreshHash,
        time + accessLifetime,
        time + 30 * 86400,
        a.id,
        a.password_hash,
      ),
      query("DELETE FROM local_sessions WHERE refresh_until<=?", time),
      query("DELETE FROM local_mail WHERE expires_at<=?", time),
    ]);
    if (!result.meta.changes) throw expired();
    return session(pair, a);
  }
  if (path === "verify") {
    if (!a) throw new HttpError("AUTH_INVALID_CODE", 400);
    const proof = [a.id, b.type!, b.token!, time];
    const pair = await tokenPair(),
      date = new Date().toISOString();
    const results = await database().batch([
      query(
        "INSERT INTO local_sessions SELECT ?,?,account_id,?,? FROM local_mail WHERE account_id=? AND purpose=? AND code=? AND expires_at>?",
        pair.accessHash,
        pair.refreshHash,
        time + accessLifetime,
        time + 30 * 86400,
        ...proof,
      ),
      query(
        "UPDATE local_accounts SET confirmed_at=COALESCE(confirmed_at,?) WHERE id IN (SELECT account_id FROM local_mail WHERE account_id=? AND purpose=? AND code=? AND expires_at>?)",
        date,
        ...proof,
      ),
      query(
        "DELETE FROM local_mail WHERE account_id=? AND purpose=? AND code=? AND expires_at>?",
        ...proof,
      ),
    ]);
    if (!results[0].meta.changes) throw new HttpError("AUTH_INVALID_CODE", 400);
    return session(pair, { ...a, confirmed_at: a.confirmed_at || date });
  }
  throw new HttpError("AUTH_FAILED", 404);
}
