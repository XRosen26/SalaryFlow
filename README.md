# 薪流 SalaryFlow

薪流是一款本地优先的个人预算、现金流、储蓄与资产管理应用，由 **XRosen26 使用 Codex 完成产品设计与开发，并持续迭代**。它帮助用户把工资、预算、日常消费、储蓄和账户余额放在同一套清晰的财务口径下管理，无需注册，也不会连接或操作银行账户。

## 下载

当前发布：**Windows 0.7.2 / Android 0.4.0 预览版**。

- [Windows 安装版 x64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.7.2/SalaryFlow-Setup-0.7.2-x64.exe)
- [Windows 便携版 x64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.7.2/SalaryFlow-Portable-0.7.2-x64.exe)
- [Android APK ARM64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.7.2/SalaryFlow-Android-0.4.0-preview-arm64-v8a.apk)

Windows 安装包暂未使用公开代码签名证书，系统可能提示“未知发布者”。便携版无需安装，账本仍保存在用户数据目录。Android 预览包支持 Android 7（API 24）及以上、按 API 36 构建，使用预览签名，适合个人试用。

## 平台状态

| 平台            | 当前版本   | 定位与状态                                             |
| --------------- | ---------- | ------------------------------------------------------ |
| Windows         | 0.7.2      | 完整桌面端；适合录入、预算规划、分析、备份与长期维护   |
| Android         | 0.4.0 预览 | 触屏优先；突出快速记账、预算、安心支出、账户和移动分析 |
| iOS / HarmonyOS | 规划中     | 待 Android 基本体验稳定后评估；继续沿用相同财务口径    |

Windows 与 Android 目前各自保存本地账本，不做多设备实时同步。完整 JSON 备份用于迁移或恢复，属于整库替换，不会合并两端同时产生的记录。

## 主要功能

- 收入、支出、转账、关联退款、固定账单和工资分配
- 工资周期或自然月预算，周期规则支持立即、下周期和指定日期生效
- 动态账户、理财估值、余额校准，以及全局和卡片/账户双层金额隐藏
- 多时间范围统计、收支规模、周期预算、收入/支出构成和分类层级分析
- 六套配色与浅色/深色主题；图表颜色随界面配色和明暗主题协调变化
- 金额输入支持 `+ - * / ( )`，最终结果以整数“分”保存，避免浮点误差
- JSON 完整备份与恢复、CSV/JSON/Markdown 导出、重复导入识别和安全重置账本
- Android 快速记账按“类型 → 分类 → 金额 → 账户 → 日期”组织；分类使用图标和文字，日期支持日历与多种输入格式
- Windows 侧栏和 Android 首页均提供显眼的使用说明入口；Android 可固定浅色/深色或跟随系统

## 财务口径

- 转账只改变账户余额，不计收入、支出或储蓄率。
- 退款关联原支出，按退款实际到账日冲减净支出，累计退款不超过原支出。
- 统计按 `transaction_date` 动态聚合；同一交易只保存一次。
- 预算值属于选定预算周期的快照，预算执行按该周期内交易的实际发生日计算。
- “当前可安心支出”取周期剩余预算与主要消费账户可用余额的较小值；预算与账户余额分别代表计划边界和现实资金。
- 理财账户的估值变化只影响资产，不伪装成收入或支出。
- 工资分配会记录真实账户转账，但应用不会连接银行或代用户执行银行转账。

## 数据与隐私

账本、设置、备份和审计记录保存在设备本地。源码、测试夹具与发布包不包含个人 SQLite 数据、备份、配置或用户目录。Android 发布清单不申请网络、旧外部存储或悬浮窗权限，并关闭系统云备份；Windows 可由用户选择数据目录并执行本地备份。

## 项目结构

- 根目录：Windows 桌面端（Electron、React、TypeScript、SQLite）
- [`mobile/`](./mobile/)：Android 端（Expo、React Native、TypeScript、Expo SQLite）
- [`RELEASE_NOTES.md`](./RELEASE_NOTES.md)：设计 V1 至当前版本的精简沿革
- [`CHANGELOG.md`](./CHANGELOG.md)：Windows 详细更新日志
- [`mobile/CHANGELOG.md`](./mobile/CHANGELOG.md)：Android 单独更新日志
- [`PRD.md`](./PRD.md)、[`PRODUCT_DESIGN.md`](./PRODUCT_DESIGN.md)、[`ARCHITECTURE.md`](./ARCHITECTURE.md)：长期维护的需求、交互与技术文档

## 本地开发与验证

```powershell
npm ci
npm test
npm run build
npm run test:desktop

cd mobile
npm ci
npm run check
.\scripts\build_android_preview.ps1
```

发布物附带 SHA-256 校验值。详细测试范围及结果见 [`VALIDATION.md`](./VALIDATION.md)。
