import { copyFile, constants } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
export async function setupEnvironment(directory) {
  try {
    await copyFile(
      join(directory, ".env.example"),
      join(directory, ".dev.vars"),
      constants.COPYFILE_EXCL,
    );
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    (await setupEnvironment(fileURLToPath(new URL("../", import.meta.url))))
      ? ".dev.vars criado. Preencha as variáveis Supabase no arquivo local."
      : ".dev.vars já existe e foi preservado.",
  );
}
