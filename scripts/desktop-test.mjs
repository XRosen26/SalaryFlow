import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const result = path.resolve("test-results");
fs.mkdirSync(result, { recursive: true });
const env = {
  ...process.env,
  SALARYFLOW_DATA_DIR: path.resolve(`.local/desktop-test-${Date.now()}`),
  SALARYFLOW_TEST: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  ...(process.env.SALARYFLOW_PACKAGED_EXE
    ? { executablePath: process.env.SALARYFLOW_PACKAGED_EXE, args: [] }
    : { args: ["."] }),
  env,
  timeout: 60000,
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "先设置你的收入节奏" }).waitFor();
  if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({ path: path.join(result, "01-onboarding.png") });
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("期初余额1").fill("700.00");
  await page.getByLabel("期初余额2").fill("3000.00");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开启我的账本" }).click();
  await page.getByRole("heading", { name: "财务总览", exact: true }).waitFor();
  const initial = await page.evaluate(() =>
    window.salaryflow.invoke("snapshot", {}),
  );
  assert(initial.ok, initial.error);
  assert.equal(initial.data.totalAssets, "370000");
  const { accounts, categories, today } = initial.data;
  const salary = accounts.find((a) => a.roles.includes("SALARY")),
    spending = accounts.find((a) => a.roles.includes("SPENDING")),
    savings = accounts.find((a) => a.roles.includes("SAVINGS"));
  const income = categories.find((c) => c.name === "工资"),
    food = categories.find((c) => c.name === "食堂/外食/外卖");
  const cmd = async (action, payload) => {
    const r = await page.evaluate(
      async ({ action, payload }) =>
        window.salaryflow.invoke("command", {
          action,
          payload,
          operation_id: crypto.randomUUID(),
        }),
      { action, payload },
    );
    assert(r.ok, r.error);
    return r.data;
  };
  await cmd("record", {
    kind: "INCOME",
    salary: true,
    date: today,
    amount_minor: "1000000",
    destination_id: salary.id,
    category_id: income.id,
    note: "本月工资",
  });
  await cmd("record", {
    kind: "TRANSFER",
    date: today,
    amount_minor: "500000",
    source_id: salary.id,
    destination_id: spending.id,
    note: "补足日常消费",
  });
  await cmd("record", {
    kind: "TRANSFER",
    date: today,
    amount_minor: "500000",
    source_id: salary.id,
    destination_id: savings.id,
    note: "长期储蓄",
  });
  await cmd("record", {
    kind: "EXPENSE",
    date: today,
    amount_minor: "98000",
    source_id: spending.id,
    category_id: food.id,
    note: "本期餐饮支出",
  });
  const transit = categories.find((c) => c.name === "交通");
  await cmd("record", {
    kind: "EXPENSE",
    date: today,
    amount_minor: "22000",
    source_id: spending.id,
    category_id: transit.id,
    note: "通勤与周末出行",
  });
  await page.reload();
  await page.getByRole("heading", { name: "财务总览", exact: true }).waitFor();
  if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({ path: path.join(result, "02-overview-light.png") });
  await page
    .getByRole("button", { name: "记一笔", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("金额（元）", { exact: false }).fill("20+15.50");
  await dialog
    .locator(".money-expression-result")
    .filter({ hasText: "35.50" })
    .waitFor();
  await dialog.getByLabel("备注").fill("桌面自动化测试");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const final = await page.evaluate(() =>
    window.salaryflow.invoke("snapshot", {}),
  );
  assert.equal(final.data.cycleReport.net, "123550");
  assert.equal(final.data.totalAssets, "1246450");
  for (const [name, file] of [
    ["交易记录", "03-transactions"],
    ["预算与周期", "04-budget"],
    ["工资分配", "05-allocation"],
    ["我的账户", "06-accounts"],
    ["统计分析", "07-analysis"],
    ["设置与数据", "08-settings"],
  ]) {
    await page
      .locator("nav")
      .getByRole("button", { name, exact: true })
      .click();
    await page.waitForTimeout(150);
    if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
      await page.screenshot({ path: path.join(result, file + ".png") });
    if (name === "交易记录") {
      await page.getByLabel("交易排序").selectOption("amount_desc");
      assert.equal(
        await page.getByLabel("交易排序").inputValue(),
        "amount_desc",
      );
    }
    if (name === "统计分析") {
      assert(
        (await page.locator(".chart-value-label").count()) > 0,
        "趋势图没有直接金额标签",
      );
      assert(
        (await page.locator(".donut-slice-label").count()) > 0,
        "环形图没有直接占比标签",
      );
      await page.getByLabel("图表分析维度").selectOption("budget");
      await page
        .getByText("预算分布绑定当前所选周期", { exact: false })
        .waitFor();
      await page.getByLabel("图表形式").selectOption("bars");
      assert(
        (await page.locator(".composition-bar-row").count()) > 0,
        "预算条形图没有数据",
      );
      await page.getByLabel("图表形式").selectOption("donut");
    }
    if (name === "预算与周期") {
      await page.getByLabel("预算排序").selectOption("budget_desc");
      assert.equal(
        await page.getByLabel("预算排序").inputValue(),
        "budget_desc",
      );
      await page
        .getByRole("button", { name: "个人默认预算", exact: true })
        .click();
      const budgetDialog = page.getByRole("dialog");
      const addBudgetCategory = budgetDialog.getByRole("button", {
        name: "添加",
        exact: true,
      });
      assert(await addBudgetCategory.isDisabled());
      const disabledHint = addBudgetCategory.locator("..");
      await disabledHint.hover();
      const tooltipBubble = page.locator(".tooltip-portal");
      await tooltipBubble.waitFor();
      assert.match(
        (await tooltipBubble.textContent()) || "",
        /已全部加入预算.*设置与数据/s,
      );
      const tooltipState = await disabledHint.evaluate((element) => ({
        expanded: element.getAttribute("aria-expanded"),
      }));
      assert.equal(tooltipState.expanded, "true", JSON.stringify(tooltipState));
      const tooltipBox = await tooltipBubble.boundingBox();
      const viewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      assert(tooltipBox && viewport, "说明气泡没有可测量的边界");
      assert(tooltipBox.x >= 0 && tooltipBox.y >= 0, "说明气泡超出左侧或顶部");
      assert(
        tooltipBox.x + tooltipBox.width <= viewport.width &&
          tooltipBox.y + tooltipBox.height <= viewport.height,
        "说明气泡超出窗口右侧或底部",
      );
      if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
        await page.screenshot({
          path: path.join(result, "10-budget-category-hint.png"),
        });
      await budgetDialog
        .getByRole("button", { name: "关闭", exact: true })
        .click();
    }
  }
  await page.getByRole("button", { name: "固定账单", exact: true }).click();
  await page.getByRole("button", { name: "新增账单" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  await page.getByRole("button", { name: "切换主题" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "总览", exact: true })
    .click();
  const safeSpendTip = page.locator(
    '.help-tip[aria-label="取本周期剩余预算与主要消费账户可用余额中较小的非负值"]',
  );
  await safeSpendTip.hover();
  const safeSpendBubble = page.locator(".tooltip-portal");
  await safeSpendBubble.waitFor();
  const safeSpendBox = await safeSpendBubble.boundingBox();
  const safeViewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  assert(safeSpendBox && safeViewport, "当前可安心支出说明没有可测量的边界");
  assert(
    safeSpendBox.x >= 0 &&
      safeSpendBox.y >= 0 &&
      safeSpendBox.x + safeSpendBox.width <= safeViewport.width &&
      safeSpendBox.y + safeSpendBox.height <= safeViewport.height,
    "当前可安心支出说明被窗口裁剪",
  );
  if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({
      path: path.join(result, "11-safe-spend-tooltip.png"),
    });
  await page.mouse.move(0, 0);
  if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({ path: path.join(result, "08-overview-dark.png") });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1100, 800);
  });
  if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({ path: path.join(result, "09-compact-dark.png") });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert(!overflow, "窗口发生横向整体溢出");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(result, "desktop-report.json"),
    JSON.stringify(
      {
        passed: true,
        runtime: await app.evaluate(() => process.versions),
        errors,
        checks: [
          "首次设置",
          "真实SQLite账本",
          "通过中文表单用金额算式新增支出",
          "七个主页面（含独立工资分配）",
          "固定账单弹层",
          "浅深主题",
          "1100px布局",
          "禁用控件原因悬停说明",
          "说明气泡自动避开卡片和窗口边界",
          "交易与预算列表排序",
          "趋势金额与环形占比直接标签",
          "周期预算环形图和条形图",
        ],
        dataDir: env.SALARYFLOW_DATA_DIR,
      },
      null,
      2,
    ),
  );
  console.log("Desktop checks PASS; screenshots in test-results");
} finally {
  await app.close();
}
