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
  timeout: process.env.SALARYFLOW_PACKAGED_EXE ? 180000 : 60000,
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
    ["固定账单", "04-bills"],
    ["工资分配", "05-allocation"],
    ["我的账户", "06-accounts"],
    ["待收款", "06-receivables"],
    ["统计分析", "07-analysis"],
    ["帮助与使用手册", "08-help"],
    ["设置与数据", "09-settings"],
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
      await page.getByRole("button", { name: "范围筛选", exact: true }).click();
      await page.getByLabel("日期范围").selectOption("days3");
      await page.getByLabel("最低金额（元）").fill("1");
      await page.getByRole("button", { name: "应用筛选", exact: true }).click();
      assert.equal(await page.getByLabel("日期范围").inputValue(), "days3");
      await page.getByRole("button", { name: "清除范围", exact: true }).click();
    }
    if (name === "固定账单") {
      await page
        .locator(".page-heading")
        .getByRole("heading", { name: "固定账单", exact: true })
        .waitFor();
      assert(
        await page
          .locator("nav")
          .getByRole("button", { name: "固定账单", exact: true })
          .evaluate((element) => element.classList.contains("selected")),
        "固定账单一级入口没有保持选中状态",
      );
      assert(
        await page
          .locator(".settings-tabs")
          .getByRole("button", { name: "固定账单", exact: true })
          .evaluate((element) => element.classList.contains("active")),
        "固定账单一级入口没有打开对应管理页",
      );
    }
    if (name === "待收款") {
      await page
        .getByRole("heading", { name: "待收款", exact: true, level: 1 })
        .waitFor();
      await page
        .getByRole("button", { name: "新增待收款", exact: true })
        .click();
      const receivableDialog = page.getByRole("dialog");
      await receivableDialog
        .getByLabel("借给谁 / 对方名称")
        .fill("桌面验收联系人");
      await receivableDialog.getByLabel("借出金额（元）").fill("20+10");
      await receivableDialog
        .getByRole("button", { name: "确认借出", exact: true })
        .click();
      await page.getByText("桌面验收联系人", { exact: true }).waitFor();
    }
    if (name === "帮助与使用手册") {
      await page
        .locator(".page-heading")
        .getByRole("heading", { name: "帮助与使用手册", exact: true })
        .waitFor();
      assert(
        await page
          .locator(".settings-tabs")
          .getByRole("button", { name: "帮助与使用手册", exact: true })
          .evaluate((element) => element.classList.contains("active")),
        "帮助入口没有打开设置中的帮助页签",
      );
    }
    if (name === "统计分析") {
      const periodSelect = page.getByLabel("选择具体日历周期");
      assert(
        (await periodSelect.locator("option").count()) > 1,
        "快捷周期没有生成可选项",
      );
      const firstPeriod = await periodSelect
        .locator("option")
        .nth(1)
        .getAttribute("value");
      assert(firstPeriod, "快捷周期首项缺少日期值");
      await periodSelect.selectOption(firstPeriod);
      await page.waitForTimeout(150);
      assert.equal(await periodSelect.inputValue(), firstPeriod);
      assert(
        (await page.locator(".chart-value-label").count()) > 0,
        "趋势图没有直接金额标签",
      );
      assert(
        (await page.locator(".donut-slice-label").count()) > 0,
        "环形图没有直接占比标签",
      );
      const paletteStrokes = [];
      for (const palette of [
        "forest",
        "ocean",
        "violet",
        "amber",
        "rose",
        "slate",
      ]) {
        const rendered = await page.evaluate((nextPalette) => {
          document.documentElement.dataset.palette = nextPalette;
          document.documentElement.dataset.theme = "light";
          const segment = document.querySelector(".donut-segment");
          const track = document.querySelector(
            ".composition-panel svg circle:not(.donut-segment)",
          );
          return {
            segment: segment ? getComputedStyle(segment).fill : "missing",
            track: track ? getComputedStyle(track).stroke : "missing",
          };
        }, palette);
        assert.notEqual(rendered.segment, "none", `${palette}圆环填充颜色无效`);
        assert.notEqual(
          rendered.segment,
          rendered.track,
          `${palette}圆环仍未使用主题填充色`,
        );
        paletteStrokes.push(rendered.segment);
      }
      assert.equal(
        new Set(paletteStrokes).size,
        6,
        "六套界面配色没有实时产生六种圆环主色",
      );
      const forestDark = await page.evaluate(() => {
        document.documentElement.dataset.palette = "forest";
        document.documentElement.dataset.theme = "dark";
        const segment = document.querySelector(".donut-segment");
        return segment ? getComputedStyle(segment).fill : "missing";
      });
      assert.notEqual(
        forestDark,
        paletteStrokes[0],
        "深色主题没有调整圆环色板",
      );
      await page.evaluate(() => {
        document.documentElement.dataset.palette = "forest";
        document.documentElement.dataset.theme = "light";
      });
      await page.getByLabel("图表分析维度").selectOption("cashflow");
      await page
        .getByText("占比仅用于比较，不等于储蓄率", { exact: false })
        .waitFor();
      assert.equal(
        await page.locator(".composition-panel .donut-legend button").count(),
        2,
        "收入与净支出构成应包含两个资金流",
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
  await page
    .locator("nav")
    .getByRole("button", { name: "固定账单", exact: true })
    .click();
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
    '.help-tip[aria-label="可支出金额取剩余预算与主要消费账户余额的较小非负值；颜色再取预算剩余比例与账户覆盖比例中较低的一项"]',
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
          "九个一级页面（含独立工资分配与待收款）",
          "固定账单弹层",
          "浅深主题",
          "1100px布局",
          "禁用控件原因悬停说明",
          "说明气泡自动避开卡片和窗口边界",
          "交易与预算列表排序",
          "交易日期及金额范围筛选",
          "待收款创建与统计隔离",
          "趋势金额与环形占比直接标签",
          "周期预算环形图和条形图",
          "六套配色与浅深主题实时更新圆环色板",
          "收入与净支出构成维度",
          "从首次记账日期生成的周月年快捷周期",
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
