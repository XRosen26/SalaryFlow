# 薪流 SalaryFlow Android

`mobile/` 是薪流的 Android 子项目，针对触屏和小屏重新组织高频入口，并与 Windows 端保持相同的整数分、交易、预算和备份口径。

## 当前版本

- 0.2.0 MVP 预览版，完整中文界面
- Android 7（API 24）及以上；target/compileSdk 36
- Expo SDK 57、React Native 0.86、TypeScript、Expo Router、SQLite
- 数据只保存在应用本地；无联网权限，系统云备份关闭

安装包：`release/SalaryFlow-Android-0.2.0-preview-arm64-v8a.apk`

SHA-256：`133473D08D2A64E689F47F1501CF30F611EBDD4B249C33B4802BEA605142BF5F`

该 ARM64 APK 内置全部资源，无需开发服务器。当前使用调试证书签名，适合个人试用；正式商店发布需要单独的长期签名密钥。

## 开发与构建

```powershell
cd mobile
npm ci
npm run check
.\scripts\build_android_preview.ps1
```

构建脚本会创建全新的短英文临时目录，避免 Windows 中文路径和 CMake 长路径问题；不会复制数据库、备份或旧发布物。Android 独立变更见 [`CHANGELOG.md`](./CHANGELOG.md)，设计与架构见本目录下的 `PRD.md`、`PRODUCT_DESIGN.md` 和 `ARCHITECTURE.md`。
