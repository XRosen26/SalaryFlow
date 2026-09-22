# 薪流 SalaryFlow

薪流是一款本地优先的个人预算、现金流、储蓄与资产管理应用，由 **XRosen26 使用 Codex 完成产品设计与开发，并持续迭代**。应用以工资周期或自然月为预算主线，把交易、账户、预算、储蓄、工资分配和统计放在一致的财务口径中；无需注册，也不会连接或操作银行账户。

## 下载

当前发布：**Windows 0.9.3 / Android 0.6.3 预览版**。

- [Windows 安装版 x64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.9.3/SalaryFlow-Setup-0.9.3-x64.exe)
- [Windows 便携版 x64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.9.3/SalaryFlow-Portable-0.9.3-x64.exe)
- [Android APK ARM64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.9.3/SalaryFlow-Android-0.6.3-preview-arm64-v8a.apk)
- [SHA-256 校验清单](https://github.com/XRosen26/SalaryFlow/releases/download/v0.9.3/SHA256SUMS.txt)

Windows 安装包暂未使用公开代码签名证书，系统可能提示“未知发布者”。Android 包使用预览签名，支持 Android 7（API 24）及以上并按 API 36 构建，适合个人试用。iOS 共用源代码与配置已经建立；IPA 需要在 macOS/Xcode 环境完成原生构建与签名，本次不提供 iOS 安装包。

## 平台状态

| 平台      | 版本           | 状态                                                                           |
| --------- | -------------- | ------------------------------------------------------------------------------ |
| Windows   | 0.9.3          | 完整桌面端，适合预算规划、批量查看、统计、备份与长期维护                       |
| Android   | 0.6.3 预览     | 触屏优先，突出快速记账、预算提醒、待收款和移动分析                             |
| iOS       | 0.6.3 源码预览 | 共用 Expo/React Native 业务代码，配置与 iOS bundle 已验证，等待 macOS 真机构建 |
| HarmonyOS | 规划中         | 待移动端基本体验稳定后再评估                                                   |

各平台当前分别保存本地账本，不做多设备实时同步。完整 JSON 备份用于移动端迁移或恢复，属于整库替换，不会合并多台设备同时产生的记录。

## iOS测试说明

测试安装不必先上架App Store。可在Mac上的Xcode使用免费Apple账号的Personal Team把应用安装到本人设备；免费签名通常7天到期，之后需要重新构建安装。普通Windows电脑上的macOS虚拟机不作为支持方案：Apple许可只允许在Apple品牌电脑上虚拟化macOS，且USB真机连接与签名不稳定。需要多人或较长期测试时，建议使用付费Apple Developer Program配合TestFlight或Ad Hoc。

## 主要功能

- 收入、支出、转账、关联退款、可修改/删除的固定账单、工资分配和待收款分次归还
- 存钱计划可关联多个储蓄/理财账户自动计算进度，也可手动维护目标、当前金额、差额和目标日期
- 工资周期或自然月预算；周期规则可立即、下周期或指定日期生效
- 动态账户与分类；未使用分类可删除、有历史分类可归档；支持理财估值、余额校准和双层金额隐藏
- 统计支持今日、最近3/7/30/90天、工资周期、自定义区间，以及从首次记账日期生成的周/月/年快捷历史周期
- 周期预算、收入/支出、收支规模、账户资产与分类层级可视化；图表随六套配色和明暗主题协调变化
- 交易可按类型、账户、分类、日期、金额范围和多种顺序筛选
- 金额输入支持 `+ - * / ( )`，最终按整数“分”保存，避免浮点误差
- JSON 完整备份与恢复、CSV/JSON/Markdown 导出、重复导入识别和安全重置账本
- 移动记账采用“类型 → 分类弹层 → 金额 → 账户 → 日期”，日期支持日历与常见中文/数字输入
- Windows 侧栏和移动首页均有使用说明入口；帮助示例来自隔离测试账本的真实页面；移动端支持六套配色与系统/浅色/深色模式

## 财务口径

- 转账只改变账户余额，不计收入、支出或储蓄率。
- 退款关联原支出，按实际到账日冲减净支出，累计退款不能超过原支出；列表把退款状态合并显示在原支出上。
- 待收款的借出与归还属于资产形态变化：借出减少账户资金，归还增加所选账户资金，均不计收支、预算或储蓄率。
- 统计按交易实际发生日动态聚合；同一交易只保存一次。
- 预算值绑定选定预算周期，预算执行按该周期内交易实际发生日计算。
- “可支出金额”取本期剩余预算与主要消费账户余额的较小非负值；状态颜色取预算剩余比例和账户覆盖比例中更紧张的一项，资金不足、接近上限、用完或超支均有明确提醒。
- 理财估值变化只影响资产，不伪装成收入或支出。
- 工资分配记录用户已在银行完成的真实转账，应用本身不会执行银行转账；超支或消费资金不足时可按完整预算、50%、固定额或自定义金额补充消费账户，预算本身不会被重置。

## 数据与隐私

账本、设置、备份和审计记录保存在设备本地。源码、测试夹具与发布包不包含个人 SQLite 数据、备份或用户目录。Android 发布清单不申请网络、旧外部存储或悬浮窗权限，并关闭系统云备份；Windows 可由用户选择数据目录并执行本地备份。

## 项目结构

- 根目录：Windows 桌面端（Electron、React、TypeScript、SQLite）
- [mobile/](./mobile/)：Android/iOS 共用移动端（Expo、React Native、TypeScript、Expo SQLite）
- [RELEASE_NOTES.md](./RELEASE_NOTES.md)：设计 V1 至当前版本的精简沿革
- [CHANGELOG.md](./CHANGELOG.md)：Windows 与整体版本详细日志
- [mobile/CHANGELOG.md](./mobile/CHANGELOG.md)：移动端单独更新日志
- [PRD.md](./PRD.md)、[PRODUCT_DESIGN.md](./PRODUCT_DESIGN.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)：长期维护的需求、交互与技术文档

## 本地开发与验证

```powershell
npm ci
npm test
npm run build
npm run test:desktop

cd mobile
npm ci
npm run check
npx expo export --platform ios
.\scripts\build_android_preview.ps1
```

发布物附带 SHA-256 校验值。详细验证结果见 [VALIDATION.md](./VALIDATION.md)。
