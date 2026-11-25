import { getPlatformProxy } from "wrangler";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
const [action, email, role] = process.argv.slice(2);
if (
  !email ||
  !["mail", "role"].includes(action) ||
  (action === "role" && !["user", "publisher", "admin"].includes(role))
) {
  console.error(
    "Use npm run local -- mail EMAIL ou npm run local -- role EMAIL user|publisher|admin.",
  );
  process.exit(1);
}
const platform = await getPlatformProxy({
  configPath: "wrangler.json",
  remoteBindings: false,
});
try {
  const db = platform.env.DB;
  if (action === "mail") {
    const { results } = await db
      .prepare(
        "SELECT purpose,code FROM local_mail JOIN local_accounts ON id=account_id WHERE email=? AND expires_at>unixepoch() ORDER BY expires_at DESC",
      )
      .bind(email.toLowerCase())
      .all();
    if (!results.length)
      throw Error("Nenhum código válido para este endereço.");
    for (const mail of results)
      console.log(
        (mail.purpose === "signup" ? "Confirmação" : "Recuperação") +
          " · " +
          mail.code,
      );
  } else {
    const result = await db
      .prepare(
        "UPDATE users SET role=? WHERE id=(SELECT 'local:'||id FROM local_accounts WHERE email=? AND confirmed_at IS NOT NULL)",
      )
      .bind(role, email.toLowerCase())
      .run();
    if (!result.meta.changes)
      throw Error(
        "Confirme a conta e abra Minha conta antes de atribuir o papel.",
      );
    console.log("Papel local atualizado.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await platform.dispose();
}
