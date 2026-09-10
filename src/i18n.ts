import english from "../core/locales/en.json";
export type Locale = "zh-CN" | "en";
const catalog: Record<string, string> = english;
export const getLocale = (): Locale =>
  localStorage.getItem("salaryflow.locale") === "en" ? "en" : "zh-CN";
export function t(source: string): string {
  if (getLocale() === "zh-CN") return source;
  if (catalog[source]) return catalog[source];
  const label = source.match(/^(.*)不能为空且最多200字$/);
  if (label) return `${t(label[1])} must contain 1–200 characters.`;
  const match = source.match(/^无法唯一匹配「(.*)」，请检查名称$/);
  if (match) return `Cannot uniquely match “${match[1]}”. Check the name.`;
  return source;
}
export function tr(source: string, ...values: unknown[]): string {
  return t(source).replace(/\{(\d+)\}/g, (_, i) =>
    String(values[Number(i)] ?? ""),
  );
}
export async function changeLocale(locale: Locale) {
  const result = await window.salaryflow!.invoke("command", {
    action: "saveSettings",
    payload: { locale },
    operation_id: crypto.randomUUID(),
  });
  if (!result.ok) throw new Error(result.error);
  localStorage.setItem("salaryflow.locale", locale);
  window.location.reload();
}
document.documentElement.lang = getLocale() === "en" ? "en" : "zh-CN";
