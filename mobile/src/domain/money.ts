export const MAX_MONEY = 9_000_000_000_000n;
const MAX_LENGTH = 200;
const MAX_TOKENS = 100;

export type BudgetTone = {
  label: '未设预算' | '正常' | '留意' | '接近预算' | '预算已用完' | '超支';
  color: string;
};

function minor(value: bigint, { signed = false, zero = false } = {}) {
  if ((!zero && value === 0n) || (!signed && value < 0n) || value > MAX_MONEY || value < -MAX_MONEY) {
    throw new Error('金额超出允许范围');
  }
  return value;
}

export function parseMoney(value: string, options: { signed?: boolean; zero?: boolean } = {}) {
  const source = String(value ?? '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(source)) throw new Error('请输入最多两位小数的金额');
  const negative = source.startsWith('-');
  const [whole, fraction = ''] = (negative ? source.slice(1) : source).split('.');
  return minor(
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (negative ? -1n : 1n),
    options,
  );
}

function gcd(a: bigint, b: bigint) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

function rational(n: bigint, d = 1n) {
  if (!d) throw new Error('除数不能为零');
  if (d < 0n) { n = -n; d = -d; }
  const common = gcd(n, d);
  return { n: n / common, d: d / common };
}

function tokenize(value: string) {
  const source = String(value ?? '').trim()
    .replace(/[＋]/g, '+').replace(/[－−]/g, '-').replace(/[＊×]/g, '*')
    .replace(/[／÷]/g, '/').replace(/[（]/g, '(').replace(/[）]/g, ')');
  if (!source) throw new Error('请输入金额');
  if (source.length > MAX_LENGTH) throw new Error('金额算式过长');
  const tokens: { type: string; value: string }[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const space = /^\s+/.exec(rest);
    if (space) { index += space[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
    if (number) {
      if (number[0].endsWith('.')) throw new Error('金额算式格式不正确');
      tokens.push({ type: 'number', value: number[0] });
      index += number[0].length;
    } else if (/^[+\-*/()]/.test(rest)) {
      tokens.push({ type: rest[0], value: rest[0] });
      index += 1;
    } else {
      throw new Error('金额算式只能包含数字和 + - * / ( )');
    }
    if (tokens.length > MAX_TOKENS) throw new Error('金额算式过长');
  }
  return tokens;
}

function evaluate(tokens: { type: string; value: string }[]) {
  let index = 0;
  const peek = () => tokens[index]?.type;
  const take = (type: string) => {
    if (peek() !== type) throw new Error('金额算式格式不正确');
    return tokens[index++];
  };
  const primary = (): { n: bigint; d: bigint } => {
    if (peek() === '+') { take('+'); return primary(); }
    if (peek() === '-') { take('-'); const v = primary(); return { n: -v.n, d: v.d }; }
    if (peek() === 'number') {
      const [whole, fraction = ''] = take('number').value.split('.');
      return rational(BigInt((whole || '0') + fraction), 10n ** BigInt(fraction.length));
    }
    if (peek() === '(') { take('('); const v = expression(); take(')'); return v; }
    throw new Error('金额算式格式不正确');
  };
  const term = () => {
    let value = primary();
    while (peek() === '*' || peek() === '/') {
      const op = tokens[index++].type;
      const right = primary();
      value = op === '*' ? rational(value.n * right.n, value.d * right.d) : rational(value.n * right.d, value.d * right.n);
    }
    return value;
  };
  const expression = () => {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[index++].type;
      const right = term();
      value = rational(value.n * right.d + (op === '+' ? 1n : -1n) * right.n * value.d, value.d * right.d);
    }
    return value;
  };
  const result = expression();
  if (index !== tokens.length) throw new Error('金额算式格式不正确');
  return result;
}

export function isMoneyExpression(value: string) {
  return /[+*/()（）×÷＋＊／]/.test(String(value ?? '')) || /\d\s*-\s*\d/.test(String(value ?? ''));
}

export function parseMoneyExpression(value: string, options: { signed?: boolean; zero?: boolean } = {}) {
  if (!isMoneyExpression(value)) return parseMoney(value, options);
  const valueRational = evaluate(tokenize(value));
  const negative = valueRational.n < 0n;
  const absolute = negative ? -valueRational.n : valueRational.n;
  const cents = (absolute * 100n + valueRational.d / 2n) / valueRational.d;
  return minor(negative ? -cents : cents, options);
}

export function formatMoney(minorValue: number | bigint, hidden = false) {
  if (hidden) return '¥ ••••';
  const value = typeof minorValue === 'bigint' ? Number(minorValue) : minorValue;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value / 100);
}

export function moneyDecimal(minorValue: number | bigint) {
  const value = BigInt(minorValue);
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function budgetTone(actual: number, budget: number): BudgetTone {
  if (budget <= 0) return { label: '未设预算', color: '#87928D' };
  const ratio = actual / budget;
  if (ratio < 0.5) return { label: '正常', color: '#2E8B63' };
  if (ratio < 0.8) return { label: '正常', color: '#78A82F' };
  if (ratio < 0.95) return { label: '留意', color: '#D69B28' };
  if (ratio < 1) return { label: '接近预算', color: '#DC6A2E' };
  if (ratio === 1) return { label: '预算已用完', color: '#D84444' };
  if (ratio < 1.2) return { label: '超支', color: '#BB2F37' };
  return { label: '超支', color: '#861C2A' };
}
