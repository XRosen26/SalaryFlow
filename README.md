# 薪流 SalaryFlow

薪流是一款本地优先的个人预算、现金流、储蓄与资产管理应用，由 **XRosen26 使用 Codex 完成产品设计与开发**。无需注册，不连接银行；账本保存在设备本地。

## 下载

当前发布：**Windows 0.7.0 / Android 0.2.0 预览版**。

- [Windows 安装版 x64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.7.0/SalaryFlow-Setup-0.7.0-x64.exe)
- [Windows 便携版 x64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.7.0/SalaryFlow-Portable-0.7.0-x64.exe)
- [Android APK ARM64](https://github.com/XRosen26/SalaryFlow/releases/download/v0.7.0/SalaryFlow-Android-0.2.0-preview-arm64-v8a.apk)

Windows 便携版无需安装，但账本仍保存在用户数据目录。安装包暂未使用公开代码签名证书，Windows 可能提示“未知发布者”。Android 包支持 Android 7（API 24）及以上，按 Android API 36 构建；预览包使用调试证书签名。

## 主要功能

- 收入、支出、转账、退款、固定账单和工资分配
- 工资周期或自然月预算，支持立即、下周期和指定日期生效
- 动态账户、理财估值、余额校准和全局/局部金额隐藏
- 多时间范围统计、预算分析、收支趋势、构成图和分类层级分析
- 金额框支持 `+ - * / ( )`，金额始终以整数“分”保存
- JSON 完整备份与恢复、CSV/JSON/Markdown 导出和账本重置
- Windows 支持中文/English；Android 当前为中文版

转账只改变账户余额，不计收入或支出；退款按到账日冲减净支出；理财估值变化只影响资产。统计按交易实际发生日计算，预算分析绑定所选预算周期。工资分配只记录用户已经完成的真实转账，应用不会操作银行。

## 项目结构

- 根目录：Windows 桌面端（Electron + React + TypeScript + SQLite）
- [`mobile/`](./mobile/)：Android 端（Expo + React Native + SQLite）
- [`RELEASE_NOTES.md`](./RELEASE_NOTES.md)：V1 至当前版本沿革
- [`CHANGELOG.md`](./CHANGELOG.md)：Windows 详细更新日志
- [`mobile/CHANGELOG.md`](./mobile/CHANGELOG.md)：Android 单独更新日志
- [`PRD.md`](./PRD.md)、[`PRODUCT_DESIGN.md`](./PRODUCT_DESIGN.md)、[`ARCHITECTURE.md`](./ARCHITECTURE.md)：长期产品与技术文档

## 本地开发

```powershell
npm ci
npm test
npm run build
npm run test:desktop

cd mobile
npm ci
npm run check
```

发布物不会包含 SQLite 账本、备份、测试数据或用户配置。SHA-256 校验文件随 GitHub Release 提供。
