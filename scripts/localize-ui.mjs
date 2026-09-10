// One-time codemod used after the Chinese MVP checkpoint. Runtime translations live in src/i18n.ts.
import ts from "typescript";
import fs from "node:fs";
const source = ts.createSourceFile(
  "App.tsx",
  fs.readFileSync("src/App.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const keys = new Set();
function translate(text) {
  const trimmed = text.trim();
  keys.add(trimmed);
  return ts.factory.createCallExpression(
    ts.factory.createIdentifier("t"),
    undefined,
    [ts.factory.createStringLiteral(trimmed)],
  );
}
const transformer = (context) => (root) => {
  function visit(node) {
    if (ts.isTemplateExpression(node)) {
      let key = node.head.text;
      node.templateSpans.forEach(
        (s, i) => (key += "{" + i + "}" + s.literal.text),
      );
      if (/[\u4e00-\u9fff]/.test(key)) {
        keys.add(key);
        return ts.factory.createCallExpression(
          ts.factory.createIdentifier("tr"),
          undefined,
          [
            ts.factory.createStringLiteral(key),
            ...node.templateSpans.map((s) => ts.visitNode(s.expression, visit)),
          ],
        );
      }
    }
    if (ts.isJsxText(node) && /[\u4e00-\u9fff]/.test(node.text))
      return ts.factory.createJsxExpression(undefined, translate(node.text));
    if (ts.isStringLiteralLike(node) && /[\u4e00-\u9fff]/.test(node.text)) {
      // Never translate business comparisons, CSV field keys, or object property names.
      const parent = node.parent;
      if (
        ts.isBinaryExpression(parent) &&
        [
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ].includes(parent.operatorToken.kind)
      )
        return node;
      if (ts.isPropertyAssignment(parent) && parent.name === node) return node;
      if (
        ts.isArrayLiteralExpression(parent) &&
        parent.elements.some(
          (x) => ts.isStringLiteral(x) && x.text === "外部交易号",
        )
      )
        return node;
      if (ts.isJsxAttribute(parent))
        return ts.factory.createJsxExpression(undefined, translate(node.text));
      return translate(node.text);
    }
    return ts.visitEachChild(node, visit, context);
  }
  return ts.visitNode(root, visit);
};
const result = ts.transform(source, [transformer]);
const output = ts
  .createPrinter({ newLine: ts.NewLineKind.LineFeed })
  .printFile(result.transformed[0]);
fs.writeFileSync(
  "src/App.tsx",
  "import { t, tr, getLocale, changeLocale } from './i18n';\n" + output,
);
fs.writeFileSync(
  ".local/translation-keys.json",
  JSON.stringify([...keys], null, 2),
);
result.dispose();
