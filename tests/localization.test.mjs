import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
test("静态界面翻译完整，插值占位符不丢失", () => {
  const en = JSON.parse(fs.readFileSync("core/locales/en.json", "utf8"));
  const src = ts.createSourceFile(
    "App.tsx",
    fs.readFileSync("src/App.tsx", "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const missing = [];
  let count = 0;
  function visit(n) {
    if (
      ts.isCallExpression(n) &&
      ["msg", "tr"].includes(n.expression.getText(src)) &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      const key = n.arguments[0].text;
      count++;
      if (!en[key]) missing.push(key);
      else {
        assert(
          !/[\u4e00-\u9fff]/.test(en[key]),
          `Chinese left in translation: ${key}`,
        );
        assert.deepEqual(
          [...key.matchAll(/\{\d+\}/g)].map((x) => x[0]),
          [...en[key].matchAll(/\{\d+\}/g)].map((x) => x[0]),
        );
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(src);
  assert.deepEqual(missing, []);
  assert(count > 400);
});
