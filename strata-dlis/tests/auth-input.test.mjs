import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loginError, authConfig } from "../lib/auth-input.ts";
import { validPasswordLength as validPassword } from "../lib/auth-policy.ts";
import { codespaceHost } from "../scripts/dev-config.ts";
test("login accepts existing short passwords; signup/reset retain stronger policy", () => {
  assert.equal(validPassword("login", "short1"), true);
  for (const mode of ["register", "change-password"])
    assert.equal(validPassword(mode, "short1"), false);
  for (const value of ["", null, 123, "a".repeat(201)])
    assert.equal(validPassword("login", value), false);
  assert.equal(loginError("<script>bad</script>"), "");
  assert.equal(
    loginError("AUTH_INVALID_CREDENTIALS"),
    "AUTH_INVALID_CREDENTIALS",
  );
});
test("provider configuration trims input and rejects missing or placeholder values", () => {
  assert.deepEqual(authConfig(" https://project.supabase.co/ ", " key "), {
    url: "https://project.supabase.co",
    key: "key",
    configured: true,
  });
  for (const url of [
    "",
    "http://project.test",
    "https://YOUR_PROJECT.supabase.co",
    "https://project.test/auth/v1",
    "https://project.test?x=1",
  ])
    assert.equal(authConfig(url, "key").configured, false);
  assert.equal(authConfig("https://project.test", "  ").configured, false);
});
test("Codespaces uses one explicit forwarded host and no automatic task or terminal restoration", () => {
  assert.equal(
    codespaceHost({ CODESPACES: "true", CODESPACE_NAME: "example-space" }),
    "example-space-5173.app.github.dev",
  );
  assert.equal(
    codespaceHost({ CODESPACES: "false", CODESPACE_NAME: "example-space" }),
    undefined,
  );
  assert.equal(
    codespaceHost({ CODESPACES: "true", CODESPACE_NAME: "*" }),
    undefined,
  );
  const config = JSON.parse(
    readFileSync("../.devcontainer/devcontainer.json", "utf8"),
  );
  assert.equal(config.postStartCommand, undefined);
  assert.equal(config.postAttachCommand, undefined);
  const settings = config.customizations.vscode.settings;
  assert.equal(settings["terminal.integrated.enablePersistentSessions"], false);
  assert.equal(settings["task.allowAutomaticTasks"], "off");
  assert.equal(settings["remote.autoForwardPorts"], false);
  assert.equal(settings["remote.restoreForwardedPorts"], false);
  assert.deepEqual(config.forwardPorts, [5173]);
});

test("environment setup creates once and never overwrites existing credentials", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { setupEnvironment } = await import("../scripts/setup-env.mjs");
  const directory = await mkdtemp(join(tmpdir(), "strata-env-test-"));
  try {
    await writeFile(
      join(directory, ".env.example"),
      "SUPABASE_URL=placeholder\n",
    );
    assert.equal(await setupEnvironment(directory), true);
    await writeFile(
      join(directory, ".dev.vars"),
      "existing-test-configuration\n",
    );
    assert.equal(await setupEnvironment(directory), false);
    assert.equal(
      await readFile(join(directory, ".dev.vars"), "utf8"),
      "existing-test-configuration\n",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
