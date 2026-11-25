import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const directory = "lib/i18n";
const read = (path) => readFileSync(path, "utf8");
const base = JSON.parse(read(join(directory, "pt-BR.json")));
const problems = [];
const variables = (text) => (text.match(/\{\w+\}/g) || []).sort().join(",");
for (const file of readdirSync(directory).filter((path) =>
  path.endsWith(".json"),
)) {
  const dictionary = JSON.parse(read(join(directory, file)));
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(dictionary),
  ])) {
    if (
      !base[key] ||
      !dictionary[key]?.trim() ||
      variables(base[key]) !== variables(dictionary[key])
    )
      problems.push(file + " · " + key);
  }
}
// Marca, notação científica e atalhos aparecem da mesma forma em todos os idiomas.
const invariant = new Set([
  "STRATA",
  "DLIS RP66 V1",
  "DLIS",
  "RP66 V1",
  "CBL",
  "VDL",
  "USIT",
  "GR",
  "SHA-256",
  "m",
  "µs",
  "npm run local -- mail",
  "· LF",
  "LF",
  "IPD USIT",
  "IPD CBL/VDL",
  "SHA-256 ·",
  "m · [",
  "USIT · MRayl",
  "· RP66",
  "IPD",
  "MRayl",
  "Δ",
  "m ·",
  "⌘/Ctrl K",
  "0–",
  "Z ≥ 10",
]);
const visibleAttributes = new Set([
  "aria-label",
  "aria-description",
  "placeholder",
  "title",
  "alt",
]);
for (const folder of ["app", "components"]) {
  for (const name of readdirSync(folder, { recursive: true }).filter((path) =>
    path.endsWith(".tsx"),
  )) {
    const path = join(folder, name);
    const source = ts.createSourceFile(
      path,
      read(path),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const report = (node, text) =>
      problems.push(
        path +
          ":" +
          (source.getLineAndCharacterOfPosition(node.getStart()).line + 1) +
          " · " +
          text,
      );
    const checkText = (node) => {
      const text = node.text.trim().replace(/\s+/g, " ");
      if (/\p{L}/u.test(text) && !invariant.has(text)) report(node, text);
    };
    const checkExpression = (node) => {
      if (!node) return;
      if (ts.isStringLiteralLike(node)) checkText(node);
      else if (ts.isTemplateExpression(node)) {
        checkText(node.head);
        for (const span of node.templateSpans) {
          checkText(span.literal);
          checkExpression(span.expression);
        }
      } else if (ts.isParenthesizedExpression(node))
        checkExpression(node.expression);
      else if (ts.isConditionalExpression(node)) {
        checkExpression(node.whenTrue);
        checkExpression(node.whenFalse);
      } else if (
        ts.isBinaryExpression(node) &&
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
        ].includes(node.operatorToken.kind)
      ) {
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken)
          checkExpression(node.left);
        checkExpression(node.right);
      }
    };
    function visit(node) {
      if (ts.isJsxText(node)) checkText(node);
      if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent))
        checkExpression(node.expression);
      if (
        ts.isJsxAttribute(node) &&
        visibleAttributes.has(node.name.getText(source)) &&
        node.initializer
      ) {
        if (ts.isStringLiteralLike(node.initializer))
          checkText(node.initializer);
        else if (ts.isJsxExpression(node.initializer))
          checkExpression(node.initializer.expression);
      }
      if (
        ts.isCallExpression(node) &&
        ["translate", "t"].includes(node.expression.getText(source))
      ) {
        const argument =
          node.arguments[0]?.getText(source) === "locale"
            ? node.arguments[1]
            : node.arguments[0];
        if (
          argument &&
          ts.isStringLiteralLike(argument) &&
          !Object.hasOwn(base, argument.text)
        )
          report(argument, argument.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    Object.keys(base).length +
      " chaves verificadas nos quatro idiomas. Nenhum literal de interface pendente.",
  );
