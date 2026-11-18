import test from "node:test";
import assert from "node:assert/strict";
import { readCatalogFiles } from "../lib/catalog.ts";

test("public catalog accepts an empty list", () => {
  assert.deepEqual(readCatalogFiles({ files: [] }), []);
});

test("malformed API envelopes become recoverable errors instead of rendering crashes", () => {
  for (const response of [undefined, null, {}, [], { error: "unavailable" }, { files: null }, { files: {} }, { files: "wrong" }]) {
    assert.throws(() => readCatalogFiles(response), /Dados inválidos/);
  }
});

test("malformed catalog records are rejected", () => {
  for (const entry of [null, 1, "invalid", {}, { id: "f1" }, { id: "", collection: "Volve" }]) {
    assert.throws(() => readCatalogFiles({ files: [entry] }), /Dados inválidos/);
  }
});

test("missing optional fields and invalid track types cannot crash React filters or cards", () => {
  const [file] = readCatalogFiles({
    files: [{ id: "f1", collection: "Volve", types: null, size: null, published_at: null }],
  });
  assert.equal(file.collection, "Volve");
  assert.deepEqual(file.types, []);
  assert.equal(file.types.includes("USIT"), false);
  assert.equal(file.size, 0);
  assert.equal(file.published_at, null);
});

test("valid publication fields are preserved and malformed type entries are filtered", () => {
  const [file] = readCatalogFiles({
    files: [{
      id: "f1", collection: "Volve", well: "A-1", company: "Volve",
      types: ["CBL", 7, null, "USIT"], size: 1024,
      publisher: "Test", original_name: "test.dlis", published_at: "2026-11-17T00:00:00Z",
    }],
  });
  assert.equal(file.well, "A-1");
  assert.deepEqual(file.types, ["CBL", "USIT"]);
  assert.equal(file.size, 1024);
  assert.equal(file.original_name, "test.dlis");
});
