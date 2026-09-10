import { useState } from "react";
import { getLocale } from "./i18n";
const topics = [
  [
    "记账与保存",
    "Recording & saving",
    "填写实际日期、账户和金额，点击保存后写入本地SQLite。每笔交易只存一次；修改增加审计历史，不增加一笔收入。未点击保存的表单不算账。",
    "Enter the actual date, account and amount, then Save to commit to local SQLite. Editing adds audit history, not duplicate income. Unsaved forms are not transactions.",
  ],
  [
    "余额不足与预算超支",
    "Balance protection & overspending",
    "付款账户余额不足默认阻止支出或转账。先核对期初余额、日期和漏记收入；确需补录历史可在偏好设置允许负余额。预算超支只是超过计划，账户有足够资金仍能记账。",
    "Insufficient funds block payments and transfers by default. Check opening balances, dates and missing income. Historical entry mode can allow negative balances. Exceeding a budget does not block a funded payment.",
  ],
  [
    "待办、规则与完成历史",
    "Bills, rules & completion history",
    "总览可随时新增固定账单。每周或每月规则到期生成待办，实际支付后点击确认支付；也可关联已记支出、延期或跳过。未来规则不能提前伪记为支出。处理记录在设置的固定账单中查看。",
    "Add recurring bills from Overview at any time. Weekly or monthly rules create due items. Confirm actual payment, link an existing expense, snooze or skip. Future rules are not expenses. Completed items remain in bill history.",
  ],
  [
    "退款与理财收入",
    "Refunds & investment income",
    "从原支出发起退款，可按剩余可退金额选择全部、25%、50%、75%，或手填。退款冲减实际到账期支出。理财收入只记到账利息、分红或已实现收益；赎回本金、账户间本金转移不能计收入。",
    "Start a refund from its original expense. Use the remaining refundable amount or 25/50/75 percent, or enter an amount. Refunds reduce spending in the receipt period. Investment income includes received interest, dividends and realized gains, not returned or transferred principal.",
  ],
  [
    "工资分配与周期",
    "Salary allocation & cycles",
    "标记工资收入后可生成分配计划，软件不会操作银行账户。完成现实转账后才确认。预算页可前往修改工资日，待生效规则可再次修改；当前周期边界只允许保留现有交易且衔接相邻周期的安全更正。结算历史不能直接重划。",
    "Mark salary income to create an allocation plan. The app cannot operate bank accounts; confirm transfers after completing them externally. Change payday for the next cycle. Current boundaries may be corrected only when existing transactions and adjacent cycles remain consistent. Settled history cannot be redrawn.",
  ],
  [
    "统计分析与空数据",
    "Analytics & empty ranges",
    "分析按交易实际发生日期统计。选择包含记录的时间范围；期初、校准、转账不会产生收支图。趋势只画截至今天的数据，可选柱状/折线、单独净支出及日期粒度；环形图可切换支出、收入和当前正余额账户。还可查看前一等长区间比较。退款可使净支出为负。",
    "Analytics use actual transaction dates. Choose a range containing your records. Opening balances, adjustments and transfers do not create income or spending. Trends plot elapsed dates only. Choose bars or lines, net spending alone, and date grouping. Donut charts show spending, income or current positive account balances. Compare the preceding equal-length range. Refunds can make net spending negative.",
  ],
  [
    "数据目录、升级和备份",
    "Data location, updates & backups",
    "默认数据在Windows用户目录，可迁移到自选父目录下的SalaryFlow-data。迁移先验证快照，重启后切换，原目录保留；已有目标账本不覆盖。程序升级不复制交易，数据库结构升级前会留安全快照。自动备份按日/月轮换，不要把备份当缓存删掉。",
    "Data default to the Windows user directory. Relocate to SalaryFlow-data under a chosen parent folder. A validated copy activates on restart; the original remains. Existing target ledgers are not overwritten. App updates do not duplicate transactions. Schema upgrades create safety snapshots; daily/monthly backups rotate. Backups are not cache.",
  ],
  [
    "删除、恢复与缓存",
    "Deletion, recovery & cache",
    "删除交易为软删除，回收站可恢复并重新校验关联。账户和分类归档保留历史。清理界面缓存不删除账本、审计或备份。恢复备份会整体替换账本，并先保存当前安全快照。备份和数据库未加密，隐藏金额只是视觉遮挡。",
    "Transactions are soft-deleted and can be restored subject to consistency checks. Archiving preserves history. Clearing UI cache keeps the ledger, audit and backups. Restoring a backup replaces the ledger after a safety snapshot. Files are unencrypted; hiding amounts is visual only.",
  ],
  [
    "关于本程序",
    "About this application",
    "薪流 SalaryFlow 0.4.0。本地个人预算与现金流工具，面向单人单账本人民币资产管理。帮助与截图可在项目README和test-results查看。信用卡、估值、多币种及云同步尚未实现。",
    "SalaryFlow 0.4.0 is a local budgeting and cash-flow tool for one person and one CNY asset ledger. See the project README and test-results for additional guidance and screenshots. Credit cards, valuations, multiple currencies and cloud sync are not implemented.",
  ],
];
export function Help() {
  const [query, setQuery] = useState("");
  const en = getLocale() === "en";
  return (
    <section className="panel help-manual">
      <h2>{en ? "Help & user manual" : "帮助与使用手册"}</h2>
      <input
        aria-label={en ? "Search help" : "搜索帮助"}
        placeholder={en ? "Search a feature or question" : "搜索功能或问题"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {topics
        .filter((t) => t.join(" ").toLowerCase().includes(query.toLowerCase()))
        .map((t) => (
          <details key={t[0]} open={!!query}>
            <summary>{t[en ? 1 : 0]}</summary>
            <p>{t[en ? 3 : 2]}</p>
          </details>
        ))}
      {!query && (
        <details>
          <summary>
            {en
              ? "Example: analytics (test ledger, Chinese interface)"
              : "界面示例：统计分析（测试账本）"}
          </summary>
          <p>
            {en
              ? "Illustrative test data, not your ledger. The chart, categories and comparison share the selected date range."
              : "以下为隔离测试账本截图，不是你的真实账目。趋势、分类和前期比较共用所选日期范围。"}
          </p>
          <img
            src={new URL("./assets/manual-analysis.png", import.meta.url).href}
            alt={
              en ? "Analytics screen using example data" : "统计分析示例截图"
            }
          />
        </details>
      )}
    </section>
  );
}
