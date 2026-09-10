import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Store } from "../core/store.mjs";
const folder = fs.mkdtempSync(path.resolve(".local/ui03-"));
const store = new Store(path.join(folder, "ledger.sqlite"));
store.command("initialize", {
  payday: 10,
  start_date: store.clock(),
  accounts: [
    { name: "日常卡", opening_minor: "100000", roles: ["SALARY", "SPENDING"] },
    { name: "储蓄卡", opening_minor: "0", roles: ["SAVINGS"] },
  ],
});
const d = store.snapshot(),
  a = d.accounts[0],
  cat = d.categories.find((c) => c.kind === "EXPENSE");
store.command("record", {
  kind: "EXPENSE",
  date: d.today,
  source_id: a.id,
  category_id: cat.id,
  amount_minor: "10001",
  note: "退款测试订单",
});
store.command("record", {
  kind: "INCOME",
  date: d.today,
  destination_id: a.id,
  category_id: "__investment",
  amount_minor: "3000",
});
store.close();
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
  const close = () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: "关闭", exact: true })
      .click();
  const bill = async (name) => {
    await page.getByRole("button", { name: "新增账单", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("账单名称").fill(name);
    await dialog.getByLabel("预计金额").fill("10");
    await dialog.getByLabel("到期日").fill(String(Number(d.today.slice(8))));
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  };
  await bill("网络订阅");
  await bill("水费提醒");
  const panel = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "本期待办", exact: true }),
    });
  assert.equal(
    await panel.getByRole("button", { name: "确认", exact: true }).count(),
    2,
  );
  await panel
    .getByRole("button", { name: "确认", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await panel.getByRole("button", { name: "确认", exact: true }).count(),
    1,
  );
  assert.equal(
    await panel.getByRole("button", { name: "新增账单", exact: true }).count(),
    1,
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "交易记录", exact: true })
    .click();
  await page.getByText("退款测试订单", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "退款", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "25%", exact: true })
    .click();
  assert.equal(
    await page.getByRole("dialog").getByLabel("本次退款金额").inputValue(),
    "25.00",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "全部剩余退款", exact: true })
    .click();
  assert.equal(
    await page.getByRole("dialog").getByLabel("本次退款金额").inputValue(),
    "100.01",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "记一笔", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("金额（元）", { exact: false })
    .fill("999999");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "余额不足" }).waitFor();
  await close();
  await page
    .locator("nav")
    .getByRole("button", { name: "统计分析", exact: true })
    .click();
  await page.getByRole("heading", { name: "收入结构", exact: true }).waitFor();
  await page.getByText("理财收益", { exact: true }).waitFor();
  assert((await page.locator(".trend-svg svg rect").count()) > 0);
  await page.getByLabel("统计时间口径").selectOption("days7");
  await page.getByRole("heading", { name: "与前一等长区间比较" }).waitFor();
  if (!env.SALARYFLOW_SKIP_SCREENSHOTS) {
    await page.screenshot({
      path: "test-results/11-analysis-03.png",
      fullPage: true,
      timeout: 30000,
    });
  }
  await page
    .locator("nav")
    .getByRole("button", { name: "预算与周期", exact: true })
    .click();
  await page
    .getByRole("button", { name: "更正当前周期边界", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("修改原因").fill("核对周期");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .locator("nav")
    .getByRole("button", { name: "设置与数据", exact: true })
    .click();
  await page
    .getByRole("button", { name: "帮助与使用手册", exact: true })
    .first()
    .click();
  await page.getByLabel("搜索帮助").fill("退款");
  assert.equal(await page.locator(".help-manual details").count(), 2);
  await page.getByLabel("搜索帮助").fill("");
  if (!env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({
      path: "test-results/12-help-03.png",
      timeout: 30000,
    });
  const before = await page.evaluate(() =>
    window.salaryflow.invoke("snapshot", {}),
  );
  const cleared = await page.evaluate(() =>
    window.salaryflow.invoke("clearCache", {}),
  );
  assert(cleared.ok);
  const after = await page.evaluate(() =>
    window.salaryflow.invoke("snapshot", {}),
  );
  assert.equal(after.data.totalAssets, before.data.totalAssets);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "test-results/iteration03-desktop.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "两个待办连续新增",
          "支付待办后仍能新增",
          "退款25%与全部剩余快捷填入",
          "余额不足实际表单拦截",
          "有数据分析图与收入结构",
          "最近7天范围",
          "当前周期更正",
          "搜索帮助",
          "缓存清理保留账本",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Iteration 0.3 desktop: PASS");
} finally {
  await app.close();
}
