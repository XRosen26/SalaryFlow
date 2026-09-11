import { MAX_MONEY, minor, parseMoney } from "./money.mjs";

const MAX_LENGTH = 200;
const MAX_TOKENS = 100;

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

function rational(n, d = 1n) {
  if (!d) throw new Error("除数不能为零");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const common = gcd(n, d);
  return { n: n / common, d: d / common };
}

function decimalRational(source) {
  const [whole, fraction = ""] = source.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  return rational(BigInt(whole + fraction), denominator);
}

function tokenize(value) {
  const source = String(value ?? "")
    .trim()
    .replace(/[＋]/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/[＊×]/g, "*")
    .replace(/[／÷]/g, "/")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
  if (!source) throw new Error("请输入金额");
  if (source.length > MAX_LENGTH) throw new Error("金额算式过长");
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const space = /^\s+/.exec(rest);
    if (space) {
      index += space[0].length;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
    if (number) {
      if (number[0].endsWith(".")) throw new Error("金额算式格式不正确");
      tokens.push({ type: "number", value: number[0] });
      index += number[0].length;
    } else if (/^[+\-*/()]/.test(rest)) {
      tokens.push({ type: rest[0], value: rest[0] });
      index += 1;
    } else {
      throw new Error("金额算式只能包含数字和 + - * / ( )");
    }
    if (tokens.length > MAX_TOKENS) throw new Error("金额算式过长");
  }
  return tokens;
}

function evaluate(tokens) {
  let index = 0;
  const peek = () => tokens[index]?.type;
  const take = (type) => {
    if (peek() !== type) throw new Error("金额算式格式不正确");
    return tokens[index++];
  };
  const primary = () => {
    if (peek() === "+") {
      take("+");
      return primary();
    }
    if (peek() === "-") {
      take("-");
      const value = primary();
      return { n: -value.n, d: value.d };
    }
    if (peek() === "number") return decimalRational(take("number").value);
    if (peek() === "(") {
      take("(");
      const value = expression();
      take(")");
      return value;
    }
    throw new Error("金额算式格式不正确");
  };
  const term = () => {
    let value = primary();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[index++].type;
      const right = primary();
      value =
        op === "*"
          ? rational(value.n * right.n, value.d * right.d)
          : rational(value.n * right.d, value.d * right.n);
    }
    return value;
  };
  const expression = () => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[index++].type;
      const right = term();
      value = rational(
        value.n * right.d + (op === "+" ? 1n : -1n) * right.n * value.d,
        value.d * right.d,
      );
    }
    return value;
  };
  const result = expression();
  if (index !== tokens.length) throw new Error("金额算式格式不正确");
  return result;
}

function roundToCents({ n, d }) {
  const negative = n < 0n;
  const absolute = negative ? -n : n;
  const cents = (absolute * 100n + d / 2n) / d;
  return negative ? -cents : cents;
}

export function isMoneyExpression(value) {
  return (
    /[+*/()（）×÷＋＊／]/.test(String(value ?? "")) ||
    /\d\s*-\s*\d/.test(String(value ?? ""))
  );
}

export function parseMoneyExpression(value, options = {}) {
  if (!isMoneyExpression(value)) return parseMoney(value, options);
  const cents = roundToCents(evaluate(tokenize(value)));
  if (cents > MAX_MONEY || cents < -MAX_MONEY)
    throw new Error("金额超出允许范围");
  return minor(cents, options).toString();
}
