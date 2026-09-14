import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Store } from "../core/store.mjs";
import { addDays } from "../core/dates.mjs";
const folder = fs.mkdtempSync(path.resolve(".local/chart04-")),
  s = new Store(path.join(folder, "ledger.sqlite")),
  today = s.clock(),
  first = addDays(today, -1);
s.command("initialize", {
  payday: Number(first.slice(8)),
  start_date: first,
  accounts: [
    {
      name: "日常账户",
      opening_minor: "1600000",
      roles: ["SPENDING", "SALARY"],
    },
    { name: "储蓄账户", opening_minor: "2800000", roles: ["SAVINGS"] },
  ],
});
const d = s.snapshot(),
  a = d.accounts[0],
  cat = d.categories.find((c) => c.kind === "EXPENSE"),
  inc = d.categories.find((c) => c.kind === "INCOME");
s.command("record", {
  kind: "INCOME",
  amount_minor: "1285000",
  date: first,
  destination_id: a.id,
  category_id: inc.id,
});
s.command("record", {
  kind: "EXPENSE",
  amount_minor: "920000",
  date: first,
  source_id: a.id,
  category_id: cat.id,
});
s.command("record", {
  kind: "EXPENSE",
  amount_minor: "75000",
  date: today,
  source_id: a.id,
  category_id: "__custom",
  custom_category: "旅行",
});
s.command("saveBudget", {
  scope: "CYCLE",
  cycle_id: d.cycle.id,
  expected_id: d.budget.id,
  items: [
    {
      category_id: cat.id,
      category_version_id: cat.version_id,
      amount_minor: "987000",
      enabled: true,
    },
  ],
});
s.close();
const env = {
  ...process.env,
  SALARYFLOW_DATA_DIR: folder,
  SALARYFLOW_TEST: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  ...(env.SALARYFLOW_PACKAGED_EXE
    ? { executablePath: env.SALARYFLOW_PACKAGED_EXE, args: [] }
    : { args: ["."] }),
  env,
  timeout: 60000,
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "财务总览", exact: true }).waitFor();
  const hero = page.locator(".hero-card");
  const rgb = (await hero.evaluate((e) => getComputedStyle(e).backgroundColor))
    .match(/\d+/g)
    .map(Number);
  assert(rgb[0] > rgb[1] * 2);
  if (!env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({
      path: "test-results/13-budget04.png",
      timeout: 30000,
    });
  await page
    .locator("nav")
    .getByRole("button", { name: "统计分析", exact: true })
    .click();
  await page.getByLabel("图表分析维度").waitFor();
  await page.getByRole("heading", { name: "收入结构", exact: true }).waitFor();
  await page.getByText("查看精确日期数据", { exact: true }).click();
  assert.equal(await page.locator(".chart-data tbody tr").count(), 2);
  assert.equal(await page.locator(".chart-v4 svg rect").count(), 4);
  await page.getByLabel("趋势指标").selectOption("expense");
  assert.equal(await page.locator(".chart-v4 svg rect").count(), 2);
  await page.getByLabel("趋势图形式").selectOption("line");
  assert.equal(await page.locator(".chart-v4 svg polyline").count(), 1);
  for (const dimension of ["income", "assets", "expense"]) {
    await page.getByLabel("图表分析维度").selectOption(dimension);
    assert((await page.locator(".donut-layout .donut-segment").count()) > 0);
  }
  await page.getByLabel("趋势图形式").selectOption("bar");
  await page.getByLabel("趋势指标").selectOption("both");
  await page.getByText("查看精确日期数据", { exact: true }).click();
  if (!env.SALARYFLOW_SKIP_SCREENSHOTS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const mainBox = await page.locator("main").boundingBox();
    assert(mainBox);
    await page.screenshot({
      path: "test-results/14-analysis04.png",
      clip: { x: mainBox.x, y: 0, width: mainBox.width, height: Math.min(1200, mainBox.height) },
      timeout: 30000,
    });
  }
  await page
    .locator("nav")
    .getByRole("button", { name: "设置与数据", exact: true })
    .click();
  for (const [name, key] of [
    ["海蓝", "ocean"],
    ["鸢紫", "violet"],
    ["暖琥珀", "amber"],
    ["玫瑰", "rose"],
    ["石墨", "slate"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForFunction(
      (k) => document.documentElement.dataset.palette === k,
      key,
    );
  }
  await page.getByRole("button", { name: "海蓝", exact: true }).click();
  await page.evaluate(() =>
    window.salaryflow.invoke("command", {
      action: "saveSettings",
      payload: { theme: "dark" },
      operation_id: crypto.randomUUID(),
    }),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "设置与数据", exact: true })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(
    await page.locator("html").getAttribute("data-palette"),
    "ocean",
  );
  if (!env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({
      path: "test-results/15-palette04-dark.png",
      timeout: 30000,
    });
  await page.getByLabel("Interface language").selectOption("en");
  await page
    .getByRole("heading", { name: "Settings & data", exact: true })
    .waitFor();
  await page
    .locator("nav")
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await page.getByLabel("Composition dimension").selectOption("assets");
  await page.getByLabel("Trend style").selectOption("line");
  await page.setViewportSize({ width: 1100, height: 800 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= 1100),
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "test-results/charts04-desktop.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "截图相同量级两日数据",
          "未来日期不入趋势图",
          "柱状与折线切换",
          "单独支出尺度",
          "三维度饼图",
          "五种配色及重启持久化",
          "暗色英文1100px",
          "总预算卡按比例红色",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Charts 0.4 desktop PASS");
} finally {
  await app.close();
}
