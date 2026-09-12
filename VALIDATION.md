# 验证记录 · Windows 0.7.0 / Android 0.2.0

## Windows 0.7.0 / Android 0.2.0验收 · 2026-09-12

Windows：56项Node测试、TypeScript/Vite构建和完整Electron桌面流程通过。对0.7.0同次构建的解包程序复跑完整流程，覆盖真实SQLite、金额算式、七个页面、说明气泡、交易/预算排序、趋势直接标签及周期预算环形/条形图。安装版与便携版使用同一打包内容；便携自解压启动器不适合Playwright直接接管。

Android：TypeScript通过，7项领域测试全部通过，新增工资分配零值保留金额回归。ARM64 Release完成576个Gradle任务，minSdk 24、target/compileSdk 36；本机ADB未连接真机或模拟器，因此本轮没有设备端点击验收。

SHA-256：Windows安装版 `6284243658810BF32D95EB76A5852C2792747C1DD136C87359623D2EF90B9890`；Windows便携版 `BC0624AA15E65091EB2C9AFEF159F8391931EF17A78420625224F3345216667C`；Android APK `133473D08D2A64E689F47F1501CF30F611EBDD4B249C33B4802BEA605142BF5F`。发布清单不含数据库、备份或用户配置。

## 0.6.2金额计算、完整说明与双语显示验收 · 2026-09-12

55项Node自动化测试通过，0失败；TypeScript/Vite生产构建、源码Electron桌面流程、0.6.2包内EXE桌面流程和包内中文/English切换均通过。新增覆盖四则运算、括号、运算优先级、除零/非法字符、普通金额两位小数约束、最终按分四舍五入，以及预置账户名称只在显示层翻译而不改写账本。

实际桌面流程在金额框输入 `20+15.50`，界面预览并保存为¥35.50的一笔交易。个人默认预算的禁用“添加”说明和总览“当前可安心支出”说明均通过可见性与窗口坐标断言，气泡四边没有超出窗口；截图为 `test-results/10-budget-category-hint.png` 和 `test-results/11-safe-spend-tooltip.png`。

包内19个应用代码与资源文件和当前构建逐字节SHA-256一致，版本、产品名、入口等元数据一致；详细记录见 `test-results/release-0.6.2.json`。安装版SHA-256为 `adafe42e3bb1c701d0f80fd6db14ebdebfc54f14c375a484a554fce4665fc3db`，免安装版为 `a02eab6effe813e1d8096c6a754edaafb50602ff1a6cc59d4f870c24b2bd12f4`，两者Authenticode状态均为NotSigned。

所有桌面测试使用 `.local` 下的隔离账本；打包清单不包含SQLite、备份或用户数据。数据库schema保持4。

## 0.6.1操作说明验收 · 2026-09-11

51项Node自动化测试通过，0失败；TypeScript/Vite生产构建、源码Electron桌面流程和0.6.1包内EXE桌面流程全部通过。中英文静态文本完整，数据库schema保持4。

桌面测试实际打开个人默认预算，确认全部支出分类已加入时“添加”按钮禁用；鼠标悬停后显示原因和“设置与数据 → 收支分类 → 新增分类”路径。气泡状态、辅助属性及截图`test-results/10-budget-category-hint.png`均已核对。已结算预算、分页、账户排序、归档分类、导入错误行及关键财务操作复用同一说明组件。

包内18个应用代码与资源文件和当前构建逐字节SHA-256一致；详细记录见`test-results/release-0.6.1.json`，成品校验值见`release/SHA256SUMS-0.6.1.txt`。两个发布文件Authenticode状态均为NotSigned。测试使用隔离账本，没有读取或打包用户个人账本；本轮没有提交或推送GitHub。

## 0.6.0周期口径、工资分配与理财估值验收 · 2026-09-11

51项Node自动化测试通过，0失败；TypeScript/Vite生产构建、源码Electron桌面流程和0.6.0包内EXE桌面流程全部通过。新增覆盖账户页总资产独立隐藏、全局与局部金额显示AND规则、工资周期/自然月口径、立即/下周期/指定日期生效、理财估值、同日流水顺序、预算与消费账户可安心支出、工资分配三种上限、批量确认、取消及删除。

包内18个应用代码与资源文件和当前构建逐字节SHA-256一致；包内name、productName、version、main元数据一致。详细记录见`test-results/release-0.6.0.json`，安装版与免安装版校验值见`release/SHA256SUMS-0.6.0.txt`。两个发布文件的Authenticode状态均为NotSigned。

测试使用隔离账本，没有读取、复制或打包用户个人账本。应用数据和备份不属于electron-builder的打包文件清单。本轮没有提交或推送GitHub。

## 0.5.0金额隐私、工资日与账本重置验收 · 2026-09-11

46项Node自动化测试通过，0失败；生产构建与Electron隔离账本桌面测试通过，0.5.0包内程序再次通过同一桌面流程。新增覆盖全局与局部金额显示AND规则、局部偏好、工资日立即/7天后生效、周期连续、清空账本限定文件及备份选择。

包内14个核心文件与当前源码SHA-256一致，已发布schema/migration未改。安装版与免安装版及校验值见test-results/release-0.5.0.json和release/SHA256SUMS-0.5.0.txt；发布者签名状态为NotSigned。本轮未提交或推送GitHub。

按用户明确要求，默认数据目录中的当前ledger.sqlite、WAL/SHM、备份状态及应用命名的本地账本备份已清除；清除后主库不存在、应用管理备份为0，下次启动进入全新账本流程。

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

| 项目                      | 实际结果与证据                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript / Vite生产构建 | 通过                                                                                                                                          |
| Node自动化                | 30项通过，0失败；tests/core.test.mjs、reliability.test.mjs、localization.test.mjs                                                             |
| 金额与可靠性              | 整数金额、转账守恒、退款上限和跨期、历史修改、三层预算、结算重新打开、校准、分类版本、账单、分配、CSV去重、备份恢复、迁移、中断恢复及随机序列 |
| 中文桌面                  | 首次配置、实际表单记支出、六页导航、账单弹层、深浅模式、1100像素窗口、余额断言；scripts/desktop-test.mjs                                      |
| 双语桌面                  | 默认中文、切English、六项导航英文、英文校验错误、切回中文、账户与分类原文不变、总资产不变；scripts/language-test.mjs                          |
| 100,000笔交易/20账户      | 六次查询313—336ms；test-results/performance-optimized.json；仅为本机数据                                                                      |
| 中文MVP检查点             | 0.1.0两种包已生成，包内程序测试通过；test-results/mvp-packaged-report.json及mvp-artifacts.json                                                |

最终0.2.0打包检查结果写入 `test-results/final-release.json`；桌面与语言测试报告分别为 `test-results/desktop-report.json`、`test-results/language-report.json`。发布前核对 ASAR 内源码、主进程及构建资源与当前文件一致，再对包内 EXE 运行这两套桌面测试。截图位于 `test-results/01-onboarding.png` 至 `10-overview-english.png`（为隔离测试账本）。

测试规格中的46项是设计清单，不等于已完成46项独立自动化测试。尚未验证真实工资周期长期使用、硬盘实际断电、干净系统安装与卸载、Windows ARM64，也未进行独立安全审计。损坏/中断恢复测试使用受控模拟；不承诺所有外部损坏均可恢复。
