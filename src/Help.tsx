import { useState } from "react";
import { getLocale } from "./i18n";

const topics = [
  [
    "快速开始",
    "Quick start",
    "首次使用先确认周期规则和账户期初余额，再设置主要工资、主要消费与主要储蓄账户。日常顺序通常是：记录工资收入 → 工资分配 → 记录支出或转账 → 查看预算与统计。软件不会连接银行，确认分配只是在账本中记录你已经实际完成的转账。",
    "Confirm the period rule and opening balances first, then assign primary salary, spending, and savings accounts. A typical flow is: record salary, allocate it, record expenses or transfers, then review budgets and analytics. The app does not connect to banks; confirming an allocation records transfers you have actually completed.",
  ],
  [
    "金额与日期输入",
    "Amounts & dates",
    "金额输入框支持 +、-、*、/ 和括号，例如 12.5+8+6*2；保存时换算为整数分并只生成一条记录。普通金额最多两位小数。日期默认今天，可用日历选择，也可输入 YYYY-MM-DD、中文年月日、斜杠日期或八位数字。",
    "Amount fields support +, -, *, / and parentheses, such as 12.5+8+6*2. The result is converted to integer cents and saved as one record. Plain amounts allow up to two decimals. Dates default to today and accept calendar selection, ISO, Chinese, slash, or eight-digit input.",
  ],
  [
    "账户、余额与金额隐藏",
    "Accounts, balances & privacy",
    "账户可以动态新增、修改、归档和校准余额。校准会生成独立调整记录，不计收入、支出、预算或储蓄率。全局金额开关与页面/账户独立开关需同时允许才显示金额；隐藏仅影响界面，数据库与备份并未加密。",
    "Accounts can be added, edited, archived, and balance-calibrated. Calibration creates an adjustment excluded from income, expenses, budgets, and savings rate. Both global and per-page/account visibility must allow an amount to be shown. Hiding is visual; the database and backups are not encrypted.",
  ],
  [
    "预算、周期与安心支出",
    "Budgets, periods & safe spending",
    "预算可按工资周期或自然月管理，规则可立即、下周期或指定日期生效。安心支出取本期剩余预算与主要消费账户可用余额中的较小非负值，状态颜色同时参考预算空间和真实资金覆盖；预算超支不会自动阻止有资金的支出。",
    "Budgets can follow salary periods or calendar months, with immediate, next-period, or specified-date changes. Safe spending is the smaller non-negative value of remaining budget and available funds in the primary spending account. Its state reflects both plan space and real cash coverage. Overspending does not block a funded expense.",
  ],
  [
    "交易、退款与范围筛选",
    "Transactions, refunds & filters",
    "交易按实际发生日期保存一次。列表可组合日期、最低/最高金额、类型、账户、分类、搜索和排序。退款必须从原支出发起，可全额、按比例或自定义；列表在原支出上显示已退款金额或已全额退款，不把退款伪装成一笔新收入。",
    "Each transaction is stored once by actual date. Combine date, amount, type, account, category, search, and sort filters. Start refunds from the original expense using full, percentage, or custom amounts. The original expense shows the refunded amount instead of presenting a new income.",
  ],
  [
    "固定账单",
    "Recurring bills",
    "固定账单规则到期后生成待办，不会提前自动扣款。实际支付后可确认生成支出，也可关联已有支出、延期或跳过。修改影响未确认待办和未来计划；删除停止后续提醒并取消未确认待办，已支付历史与真实交易继续保留。",
    "Recurring rules create due items without automatic payment. After paying, confirm a new expense or link an existing one; you can also snooze or skip. Edits affect unconfirmed and future items. Deletion stops reminders and cancels unconfirmed items while keeping paid history and transactions.",
  ],
  [
    "工资分配",
    "Salary allocation",
    "先把收入标记为工资，再进入工资分配。建议会参考预算缺口、主要消费账户余额、源账户保留金额和所选上限。超支或消费资金不足时可按完整预算、50%、固定金额或自定义金额补充；确认只生成内部转账，不重置预算，也不计收入或支出。",
    "Mark income as salary before allocation. Suggestions use the budget gap, primary spending balance, retained source amount, and selected cap. When overspent or underfunded, top up by full budget, 50%, presets, or a custom amount. Confirmation creates internal transfers only; it does not reset budgets or count as income or expense.",
  ],
  [
    "待收款",
    "Receivables",
    "待收款记录借给谁、借出账户、可选归还日和备注，支持分次归还及选择实际回款账户。借出与归还只改变账户资金和待收余额，不计收支、预算或储蓄率。误录可确认撤销；关联流水一并撤销并恢复余额。",
    "Receivables track the borrower, source account, optional due date, and note. Partial repayments can use any return account. Lending and repayment affect account cash and outstanding balance only. Mistakes can be cancelled with confirmation, reversing linked entries and balances.",
  ],
  [
    "存钱计划",
    "Savings plans",
    "先填写目标金额，再选择进度方式。“关联账户余额”表示把所选账户当前余额合计为计划进度，只读取余额，不移动资金、不创建交易；账户之间转账也不会重复累计。“手动维护进度”适合不对应具体账户的目标，直接填写目前已存金额。计划显示目前、还差和完成比例；删除计划不会删除账户或交易。",
    "Enter a target, then choose a progress method. Linked account balances sum the current balances of selected accounts; this reads balances without moving money or creating transactions, and transfers between linked accounts are not double-counted. Manual progress suits goals without dedicated accounts. Plans show current, remaining, and completion percentage. Deleting a plan keeps accounts and transactions.",
  ],
  [
    "统计分析",
    "Analytics",
    "统计按交易实际发生日期计算，可用今日、近3/7/30/90天、工资周期、周/月/年历史周期和自定义范围。可按全部账户或单一账户查看收入、净支出、构成和趋势；退款冲减原支出，期初、校准、转账和待收款不属于收支。图表与列表共用所选范围和账户。",
    "Analytics use actual dates and support today, rolling ranges, salary periods, historical week/month/year periods, and custom dates. View income, net spending, composition, and trends for all or one account. Refunds reduce original expenses; openings, calibration, transfers, and receivables are excluded. Charts and lists share the selected range and account.",
  ],
  [
    "分类与历史口径",
    "Categories & historical labels",
    "分类名称和分组可修改，但历史交易保留发生时版本。完全未被交易、预算或固定账单使用的分类可以彻底删除；已有历史的分类只能归档，以免破坏旧账、统计和预算版本。",
    "Category names and groups can be edited while historical transactions retain their original version. Unused categories can be deleted permanently. Categories referenced by transactions, budgets, or bills must be archived to preserve history and analytics.",
  ],
  [
    "外观、语言与图表配色",
    "Appearance, language & chart colors",
    "可选择六套界面配色及浅色/深色模式，统计图表会使用与当前配色协调的色板，预算风险色仍按风险等级显示。界面可切换中文或English，切换只改变显示文字，不改写账户、分类和交易数据。",
    "Choose from six palettes and light or dark mode. Analytics use a coordinated chart palette, while budget risk colors still follow risk levels. Switch between Chinese and English without rewriting account, category, or transaction data.",
  ],
  [
    "数据、备份与重新开始",
    "Data, backup & reset",
    "数据保存在本地 SQLite，可迁移数据目录、导入导出并创建完整备份。恢复会先保存当前安全快照，再整体替换账本。清理界面缓存不删除财务数据；“重新开始/清空账本”会清除账本内容，应先备份。程序升级不复制交易，数据库迁移前会建立安全快照。",
    "Data use local SQLite with relocation, import/export, and full backups. Restore creates a safety snapshot before replacing the ledger. Clearing UI cache keeps financial data, while reset clears the ledger and should follow a backup. Updates do not duplicate transactions, and migrations create safety snapshots.",
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
    "薪流 SalaryFlow 0.9.3 是持续迭代的本地优先个人预算、现金流、储蓄目标与资产管理产品。当前提供 Windows 桌面端与 Android 预览版，iOS 共用工程已搭建；各平台针对屏幕和输入方式优化，并沿用一致的财务口径。",
    "SalaryFlow 0.9.3 is an evolving, local-first product for budgeting, cash flow, savings goals, and assets. Windows and an Android preview are available, and the shared iOS project is ready for macOS/Xcode packaging. All platforms follow consistent financial rules.",
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
        .filter((topic) =>
          topic.join(" ").toLowerCase().includes(query.toLowerCase()),
        )
        .map((topic) => (
          <details key={topic[0]} open={!!query}>
            <summary>{topic[en ? 1 : 0]}</summary>
            <p>{topic[en ? 3 : 2]}</p>
          </details>
        ))}
      {!query && (
        <details>
          <summary>
            {en
              ? "Example: analytics (isolated test ledger)"
              : "界面示例：统计分析（隔离测试账本）"}
          </summary>
          <p>
            {en
              ? "This is a real capture of the current isolated test ledger, not your data. Charts, categories, account filtering, and comparisons share the selected date range."
              : "以下是当前版本隔离测试账本的真实截图，不含你的账目。图表、分类、账户筛选和前期比较共用所选日期范围。"}
          </p>
          <img
            src={new URL("./assets/manual-analysis.png", import.meta.url).href}
            alt={en ? "Current analytics example" : "当前统计分析示例"}
          />
        </details>
      )}
    </section>
  );
}
