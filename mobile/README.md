# 薪流 SalaryFlow Android

`mobile/` 是薪流的 Android 优先移动端子项目，与仓库根目录的 Windows 桌面端并列维护。移动端针对触屏和小屏重新设计，高频入口集中在首页与底部导航；财务规则、整数分模型和完整备份格式与桌面端保持同一口径。

## 当前版本

- 版本：0.1.0 MVP 预览
- 技术：Expo SDK 57、React Native 0.86、TypeScript、Expo Router、SQLite
- 系统：Android 7（API 24）及以上；编译和目标 API 36（Android 16）
- 包名：`com.xrosen26.salaryflow`
- 数据：只保存在应用本地；无联网权限；Android 系统云备份关闭
- 语言：当前为完整中文版；English 在中文版稳定后加入

## 安装包

本地可直接安装的 ARM64 release 预览包：

`release/SalaryFlow-Android-0.1.0-preview-arm64-v8a.apk`

SHA-256：

`606531E8FD929C59E2F20388ECE9DEEDE22F0616686B570DAC93C0087C886A2F`

该包内置 JavaScript 和资源，可脱离开发服务器运行。它使用 Android 调试证书签名，仅用于个人试用；Google Play 或长期公开分发前需要创建并妥善保管正式签名密钥。

## 开发与校验

```powershell
cd mobile
npm ci
npm run check
npx expo-doctor
```

由于 Windows 原生工具链对中文路径和长路径有限制，预览 APK 使用仓库内的构建脚本。脚本只复制源代码和锁定依赖到固定短英文构建目录，不复制 `release/`、数据库或用户备份：

```powershell
.\scripts\build_android_preview.ps1
```

## 文档

- [PRD.md](./PRD.md)：需求、范围、验收状态和待确认决策
- [PRODUCT_DESIGN.md](./PRODUCT_DESIGN.md)：信息架构、流程和移动端交互规范
- [ARCHITECTURE.md](./ARCHITECTURE.md)：技术、数据库、备份和测试设计
- [CHANGELOG.md](./CHANGELOG.md)：每次迭代的实现、问题和判断

桌面端或移动端的个人账本、恢复点、导出文件和缓存不会进入源码或安装包。