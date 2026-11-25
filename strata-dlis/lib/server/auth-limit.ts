import { database, query } from "./db";
import { HttpError } from "./errors";

const limits: Record<string, number> = {
  login: 10,
  register: 5,
  verify: 8,
  recover: 5,
  resend: 5,
  "change-password": 5,
};
export const windowSeconds = 600;
async function key(action: string, value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(action + "|" + value),
  );
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function limitAuth(
  request: Request,
  action: string,
  email: string,
) {
  const limit = limits[action];
  if (!limit) return;
  const now = Math.floor(Date.now() / 1000);
  const subjects = [{ value: "email:" + email.toLowerCase(), max: limit }];
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) subjects.push({ value: "ip:" + ip, max: limit * 10 });
  const statements = await Promise.all(
    subjects.map(async ({ value }) =>
      query(
        "INSERT INTO auth_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count",
        await key(action, value),
        now + windowSeconds,
        now,
        now,
      ),
    ),
  );
  const rows = await database().batch<{ count: number }>([
    ...statements,
    query("DELETE FROM auth_attempts WHERE expires_at<=?", now),
  ]);
  if (subjects.some(({ max }, i) => rows[i].results[0].count > max))
    throw new HttpError("AUTH_RATE_LIMIT", 429);
}
