# 验证记录 · 0.2.0

## 0.4.0图表与配色验收 · 2026-09-07

43项自动化测试通过。新增截图回归场景：2026-09-06至10-05工资周期，在9月7日只绘制9月6、7日，分别保留大额收入和支出；历史范围补零、长范围合计守恒、负净支出保留。饼图正值筛选/其他合计及五配色持久化已测试。

scripts/charts04-desktop.mjs实际点击验证两日趋势、柱状/折线、净支出独立尺度、支出/收入/账户饼图、五配色、重新加载恢复、暗色英文1100像素布局，以及接近用尽预算时总览卡为红色。截图13-budget04、14-analysis04、15-palette04-dark已目视检查。

最终0.4.0包内验收及文件校验见test-results/release-0.4.0.json；图表交互报告见test-results/charts04-desktop.json。测试使用独立账本，未读取或修改用户真实账本。

最终结果：包内图表/配色、双语、基础记账三套桌面测试全部通过；17个包内代码与资源文件与当前源文件一致；原schema/migration未变。安装及免安装包SHA-256已生成，发布者签名状态为NotSigned。

## 0.3.0增量验证 · 2026-09-07

生产构建通过；39项Node自动化全部通过（新增tests/iteration03.test.mjs九项），0失败。新覆盖：默认余额保护及原子回滚、历史补录开关、编辑原记录余额排除、历史日期资金检查、自定义分类和理财收益、多待办支付撤销、周期边界和待生效工资日、前期分析及收入结构、目录迁移/原库保留/禁止覆盖、预算渐变边界。

scripts/iteration03-desktop.mjs已通过实际UI操作：连续新增两个账单、支付后新增入口保留、25%及全部剩余退款、余额不足表单提示、非空分析图及最近7天、当前周期更正、帮助搜索、清理缓存保留总资产。截图11-analysis-03.png和12-help-03.png已目视检查；帮助附带隔离测试账本示例图。

0.3.0包内验证及SHA-256见test-results/release-0.3.0.json，功能桌面报告见test-results/iteration03-desktop.json。数据目录迁移已做真实SQLite文件复制与校验测试；未自动操作用户真实数据目录。下文0.2.0为历史基线记录。

最终验收：0.3.0包内EXE的基础中文流程、中文/English切换及新增功能三套桌面测试全部通过；16个打包源码/资源文件与工作区一致，已发布schema及migration与中文MVP逐字节一致。安装版与免安装版已生成SHA-256清单，未签名；未自动安装到用户系统。

日期：2026-09-06。本机 Windows x64；测试账本与真实用户数据隔离。

| 项目 | 实际结果与证据 |
|---|---|
| TypeScript / Vite生产构建 | 通过 |
| Node自动化 | 30项通过，0失败；tests/core.test.mjs、reliability.test.mjs、localization.test.mjs |
| 金额与可靠性 | 整数金额、转账守恒、退款上限和跨期、历史修改、三层预算、结算重新打开、校准、分类版本、账单、分配、CSV去重、备份恢复、迁移、中断恢复及随机序列 |
| 中文桌面 | 首次配置、实际表单记支出、六页导航、账单弹层、深浅模式、1100像素窗口、余额断言；scripts/desktop-test.mjs |
| 双语桌面 | 默认中文、切English、六项导航英文、英文校验错误、切回中文、账户与分类原文不变、总资产不变；scripts/language-test.mjs |
| 100,000笔交易/20账户 | 六次查询313—336ms；test-results/performance-optimized.json；仅为本机数据 |
| 中文MVP检查点 | 0.1.0两种包已生成，包内程序测试通过；test-results/mvp-packaged-report.json及mvp-artifacts.json |

最终0.2.0打包检查结果写入 `test-results/final-release.json`；桌面与语言测试报告分别为 `test-results/desktop-report.json`、`test-results/language-report.json`。发布前核对 ASAR 内源码、主进程及构建资源与当前文件一致，再对包内 EXE 运行这两套桌面测试。截图位于 `test-results/01-onboarding.png` 至 `10-overview-english.png`（为隔离测试账本）。

测试规格中的46项是设计清单，不等于已完成46项独立自动化测试。尚未验证真实工资周期长期使用、硬盘实际断电、干净系统安装与卸载、Windows ARM64，也未进行独立安全审计。损坏/中断恢复测试使用受控模拟；不承诺所有外部损坏均可恢复。
