declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    ADMIN_USER_IDS?: string;
  }
}
