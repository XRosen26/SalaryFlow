import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Store } from "../core/store.mjs";
const folder = path.resolve(`.local/language-test-${Date.now()}`);
const store = new Store(path.join(folder, "ledger.sqlite"));
store.command("initialize", {
  payday: 10,
  start_date: store.clock(),
  accounts: [
    {
      name: "我的银行卡",
      opening_minor: "123456",
      roles: ["SALARY", "SPENDING"],
    },
  ],
});
store.close();
const env = {
  ...process.env,
  SALARYFLOW_DATA_DIR: folder,
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
  await page.getByRole("heading", { name: "财务总览", exact: true }).waitFor();
  const initial = await page.evaluate(() =>
    window.salaryflow.invoke("snapshot", {}),
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "设置与数据", exact: true })
    .click();
  await page.getByLabel("Interface language").selectOption("en");
  await page
    .getByRole("heading", { name: "Settings & data", exact: true })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  for (const name of [
    "Overview",
    "Transactions",
    "Budgets & cycles",
    "Accounts",
    "Analytics",
    "Settings & data",
  ])
    assert.equal(
      await page
        .locator("nav")
        .getByRole("button", { name, exact: true })
        .count(),
      1,
    );
  await page
    .locator("nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Financial overview", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Amount (CNY)", { exact: false })
    .fill("1.001");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({
      hasText: "Enter an amount with no more than two decimal places.",
    })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  if (!process.env.SALARYFLOW_SKIP_SCREENSHOTS)
    await page.screenshot({
      path: "test-results/10-overview-english.png",
      timeout: 30000,
    });
  const english = await page.evaluate(() =>
    window.salaryflow.invoke("snapshot", {}),
  );
  assert.equal(english.data.totalAssets, initial.data.totalAssets);
  assert.equal(english.data.accounts[0].name, "我的银行卡");
  assert.deepEqual(english.data.categories, initial.data.categories);
  await page
    .locator("nav")
    .getByRole("button", { name: "Settings & data", exact: true })
    .click();
  await page.getByLabel("Interface language").selectOption("zh-CN");
  await page
    .getByRole("heading", { name: "设置与数据", exact: true })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "test-results/language-report.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "默认中文",
          "设置中切换English",
          "六个导航标签英文",
          "英文金额校验错误",
          "切回中文",
          "账户名称与分类保持原文",
          "总资产不变",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Language switch and financial invariance: PASS");
} finally {
  await app.close();
}
