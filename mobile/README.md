# 薪流 SalaryFlow 移动端

`mobile/` 是 Android 与 iOS 共用的移动端项目。它与 Windows 端共享整数分、交易、退款、转账、预算、待收款和备份口径，并针对触屏、小屏、软键盘和移动场景重新组织首页、快速记账、预算与账户入口。

## 当前版本

- **0.5.0 预览版**
- Android 7（API 24）及以上，target/compileSdk 36；ARM64 APK 位于 `release/`
- iOS Bundle ID 为 `com.xrosen26.salaryflow`；Expo iOS bundle 已验证，原生 IPA 需 macOS/Xcode
- Expo SDK 57、React Native 0.86、TypeScript、Expo Router、Expo SQLite
- 数据仅保存在应用本地；六套配色，可跟随系统或固定浅色/深色
- 中文系统启动器显示“薪流”，其他语言环境显示“SalaryFlow”
- 当前APK SHA-256：91DAB9B6A445B7E6D12B3F7494F329259552A406DE1312D9B9D9BD3677983AE2

## 移动端重点

- 首页预算卡复用七级绿到红风险色；预算用完或超支后改为明确提醒。
- “记一笔”先选交易类型，再通过紧凑弹层选择图标分类；选中即收起，账户也使用动态弹层。
- 日期可点月历，也识别 `2026-09-13`、`2026年9月13日`、`2026/9/13` 和 `20260913`。
- 交易明细保留类型、搜索和排序，并新增快捷/自定义日期及最低/最高金额筛选。
- 统计按实际发生日聚合，提供今日、最近3/7/30/90天、周期、月、年，以及支出、收入、预算与分类层级分析。
- 待收款支持对方、借出账户、可选归还日、逾期提示、分次归还和回款账户；不重复计作收支。
- 账户支持工资、主要消费、主要储蓄与理财角色，以及全局和独立金额隐藏。
- 完整 JSON 备份用于整库迁移或恢复，不合并多台设备同时产生的记录。

## 开发与构建

```powershell
cd mobile
npm ci
npm run check
npx expo export --platform ios --output-dir dist-ios
.\scripts\build_android_preview.ps1
```

Android 构建脚本只在项目内生成原生目录与发布 APK，不复制数据库、备份或用户数据。iOS 原生调试、签名和 IPA 构建必须在安装 Xcode 的 macOS 上完成。
