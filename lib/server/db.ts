import { env } from "cloudflare:workers";
export const database = () => {
  if (!env.DB) throw new Error("Banco temporariamente indisponível.");
  return env.DB;
};
export const bucket = () => {
  if (!env.BUCKET)
    throw new Error("Armazenamento temporariamente indisponível.");
  return env.BUCKET;
};
export const query = (sql: string, ...args: any[]) =>
  database()
    .prepare(sql)
    .bind(...args);
