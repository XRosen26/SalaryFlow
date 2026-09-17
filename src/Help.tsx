import { useState } from "react";
import { getLocale } from "./i18n";
const topics = [
  [
    "金额快速计算",
    "Quick amount calculation",
    "金额输入框支持 +、-、*、/ 和括号，例如输入 12.5+8+6*2，界面会先显示计算结果，保存时只生成一笔交易。普通金额仍最多两位小数；除法等产生更多小数时，最终结果四舍五入到分。合并后无法分别分析每个组成金额，需要逐笔统计时请分别记账。",
    "Amount fields support +, -, *, / and parentheses. For example, 12.5+8+6*2 shows a result before saving and creates one transaction. Plain amounts still allow at most two decimal places; calculations are rounded to cents only at the final result. Combined parts cannot be analyzed separately, so record separate transactions when you need item-level analysis.",
  ],
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
    "工资分配与预算周期",
    "Salary allocation & budget periods",
    "工资分配现在是独立一级页面。标记工资收入后，助手按剩余预算和主要消费账户余额计算补足额，并把余款安排到储蓄或理财；软件不会操作银行。预算可按工资周期或自然月管理，规则可立即、下周期或指定未来日期生效。",
    "Salary allocation is a main page. After marking salary income, it uses remaining budget and the primary spending balance to calculate a top-up and direct the remainder to savings or investments. It never operates a bank. Budgets can use salary cycles or calendar months, with immediate, next-period or specified-date changes.",
  ],
  [
    "待收款与归还",
    "Receivables & repayments",
    "待收款用于记录借给他人的临时资金。对方必填，预计归还日可选；可分次归还并选择回款账户。借出与归还只改变账户和待收余额，不计收入、支出、预算执行率或储蓄率。",
    "Receivables track temporary lending. The person is required and the due date is optional. Partial repayments can use any destination account. Lending and repayment change account cash and the outstanding balance, but not income, spending, budgets, or the savings rate.",
  ],
  [
    "交易范围筛选",
    "Transaction range filters",
    "交易记录可同时使用快捷或自定义日期、最低/最高金额、类型、账户、分类、搜索和排序。日期结束值按所选当天完整包含，金额按绝对值筛选。",
    "Transactions can combine quick or custom dates, minimum/maximum amounts, type, account, category, search, and sort. The selected end date is inclusive, and amount filters use absolute values.",
  ],
  [
    "统计分析与空数据",
    "Analytics & empty ranges",
    "分析按交易实际发生日期统计，可快速查看今日、最近3天等范围。期初、校准、转账和待收款不会产生收支图。趋势只画截至今天的数据，可选柱状/折线、单独净支出及日期粒度；构成图可切换支出、收入、收入与净支出、当前周期预算和正余额账户，并可使用环形图或条形图。还可查看前一等长区间比较。退款可使净支出为负。",
    "Analytics use actual transaction dates and include quick ranges such as today and the last three days. Opening balances, adjustments, transfers, and receivables do not create income or spending. Trends plot elapsed dates only. Choose bars or lines, net spending alone, and date grouping. Composition charts cover spending, income, income versus net spending, the selected period budget, and positive account balances in donut or bar form. Compare the preceding equal-length range. Refunds can make net spending negative.",
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
    "关于作者",
    "About the creator",
    "由 XRosen26 完成并持续迭代。",
    "Created and continuously improved by XRosen26.",
  ],
  [
    "关于本程序",
    "About this application",
    "薪流 SalaryFlow 0.9.1 是持续迭代的本地优先个人预算、现金流与资产管理产品，当前提供 Windows 桌面端和 Android 预览版，iOS 共用工程已搭建。各平台按屏幕与输入方式设计，并共享整数金额、交易、预算和统计口径。",
    "SalaryFlow 0.9.1 is an evolving, local-first personal budgeting, cash-flow, and asset management product. Windows and Android are available today, while the shared iOS project is ready for macOS/Xcode packaging. All platforms use the same integer-money, transaction, budget, and analytics rules.",
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
              ? "A real capture of the isolated test ledger main content, without a duplicated sidebar. It is not your ledger. The chart, categories, and comparison share the selected date range."
              : "以下为隔离测试账本的真实主内容区截图，不含重复侧栏，也不是你的真实账目。趋势、分类和前期比较共用所选日期范围。"}
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
