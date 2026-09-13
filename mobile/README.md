# 薪流 SalaryFlow Android

`mobile/` 是薪流的 Android 子项目。它与 Windows 端共享整数分、交易、退款、转账、预算和备份口径，并针对触屏、小屏与移动场景重新组织首页、快速记账、预算和账户入口。

## 当前版本

- **0.4.0 预览版**，应用内当前为中文界面
- Android 7（API 24）及以上；target/compileSdk 36
- Expo SDK 57、React Native 0.86、TypeScript、Expo Router、Expo SQLite
- 数据只保存在应用本地；无联网权限，系统云备份关闭
- 六套配色，可跟随系统或固定浅色/深色主题
- 中文系统启动器显示“薪流”，其他语言环境显示“SalaryFlow”

安装包：`release/SalaryFlow-Android-0.4.0-preview-arm64-v8a.apk`

SHA-256：B378D0FD642ED4B515B15625F34097B5B4FB14AD5BD256A11CBC8690013DE0EF，并保存在同目录 `.sha256` 文件及 GitHub Release。ARM64 APK 内置全部资源，无需开发服务器。当前使用预览签名，适合个人试用；正式商店发布需要长期签名密钥与 AAB。

## 移动端重点

- 首页集中展示当前可安心支出、周期预算、账单和近期交易；安心支出卡与预算使用率使用同一套七级绿到红风险色。
- 中央“记一笔”支持收入、支出、转账和关联退款；按类型、分类、金额、账户、日期组织，完整分类以图标和文字展示。
- 日期既可点月历，也可输入中文年月日、连字符、斜杠或八位数字；保存时统一校验。
- 预算支持工资周期或自然月，以及立即、下周期和指定日期生效。
- 账户支持工资、主要消费、主要储蓄与理财角色，以及全局和独立金额隐藏。
- 统计按实际发生日聚合，提供收入、净支出、周期预算、构成和分类层级分析。
- 首页问号直达使用说明与关于；设置集中提供周期、分类、账单、账户、外观、隐私和数据管理。
- 完整 JSON 备份用于整库迁移或恢复，不合并两台设备同时产生的记录。

## 开发与构建

```powershell
cd mobile
npm ci
npm run check
.\scripts\build_android_preview.ps1
```

构建脚本只在本项目的 `mobile/android` 生成 Expo 原生目录，发布 APK 写入 `mobile/release`；不会复制数据库、备份、旧发布物或用户数据。Android 独立变更见 [`CHANGELOG.md`](./CHANGELOG.md)，设计与架构见本目录下的 [`PRD.md`](./PRD.md)、[`PRODUCT_DESIGN.md`](./PRODUCT_DESIGN.md) 和 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。
