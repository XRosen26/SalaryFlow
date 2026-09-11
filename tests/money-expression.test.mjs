import test from "node:test";
import assert from "node:assert/strict";
import {
  isMoneyExpression,
  parseMoneyExpression,
} from "../core/money-expression.mjs";

test("金额输入支持四则运算、优先级和括号", () => {
  assert.equal(parseMoneyExpression("10 + 20 * 3"), "7000");
  assert.equal(parseMoneyExpression("(10 + 20) * 3"), "9000");
  assert.equal(parseMoneyExpression("100－25×2"), "5000");
  assert.equal(parseMoneyExpression("10÷4"), "250");
});

test("金额算式按最终结果四舍五入到分", () => {
  assert.equal(parseMoneyExpression("10 / 3"), "333");
  assert.equal(parseMoneyExpression("-10 / 3", { signed: true }), "-333");
  assert.equal(parseMoneyExpression("0.1 + 0.2"), "30");
});

test("金额算式拒绝除零、未知字符和不完整表达式", () => {
  assert.throws(() => parseMoneyExpression("10 / 0"), /除数不能为零/);
  assert.throws(() => parseMoneyExpression("10 ** 2"), /格式不正确/);
  assert.throws(() => parseMoneyExpression("alert(1)"), /只能包含/);
  assert.throws(() => parseMoneyExpression("1 +"), /格式不正确/);
  assert.throws(() => parseMoneyExpression("1.001"), /最多两位小数/);
});

test("金额算式识别不会把普通负数误判为组合计算", () => {
  assert.equal(isMoneyExpression("12.34"), false);
  assert.equal(isMoneyExpression("-12.34"), false);
  assert.equal(isMoneyExpression("12-3"), true);
});
