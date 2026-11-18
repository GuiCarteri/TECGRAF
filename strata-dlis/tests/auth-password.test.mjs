import test from "node:test";
import assert from "node:assert/strict";
import { validPasswordLength } from "../lib/auth-policy.ts";

test("login accepts existing short non-empty passwords", () => {
  assert.equal(validPasswordLength("login", "a"), true);
  assert.equal(validPasswordLength("login", "1234567"), true);
  assert.equal(validPasswordLength("login", "12345678"), true);
  assert.equal(validPasswordLength("login", ""), false);
  assert.equal(validPasswordLength("login", "x".repeat(201)), false);
  assert.equal(validPasswordLength("login", null), false);
});

test("registration and password changes still enforce minimum eight characters", () => {
  for (const action of ["register", "change-password"]) {
    assert.equal(validPasswordLength(action, "1234567"), false);
    assert.equal(validPasswordLength(action, "12345678"), true);
    assert.equal(validPasswordLength(action, "x".repeat(201)), false);
  }
});
