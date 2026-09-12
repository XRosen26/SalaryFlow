# 薪流 Android 技术与数据设计

版本：0.1　更新：2026-09-12

## 1. 技术基线

- Expo SDK 57、React Native 0.86、React 19.2、Expo Router、TypeScript 6。
- `expo-sqlite` 保存账本；WAL、外键约束、独占事务和参数绑定。
- React Context + repository hooks 管理数据刷新；不在 UI 中拼接 SQL。
- `react-native-svg` 绘制基础图表；列表规模扩大后评估 FlashList。
- `expo-file-system`、DocumentPicker、Sharing 负责备份交换；生物识别/PIN 确定进入 P1 时再引入密钥存储与认证依赖。

Expo SDK 57 默认 `compileSdkVersion=36`、`targetSdkVersion=36`，支持 Android 7+。应用启用 edge-to-edge、预测返回和横竖屏自适应。应用 ID `com.xrosen26.salaryflow` 与签名密钥从首次分发起保持稳定。

## 2. 分层

```text
UI routes/components
  ↓ commands + query hooks
Application services（交易、预算、分配、恢复）
  ↓ typed repository interfaces
Expo SQLite repository
  ↓
salaryflow-mobile.db + backups
```

`domain/` 仅包含平台无关的金额、日期、周期和聚合规则，可用 Node 直接测试。`data/` 负责迁移和数据库读写。桌面端同步业务规则测试向量，但不直接引用 Node `node:sqlite` 运行时。

## 3. 数据模型

移动数据库首版采用与桌面 schema 4 等价的核心概念，并增加自身 `PRAGMA user_version`。主要表：

- `settings`：预算口径、工资日、隐私和界面设置。
- `account_types`、`accounts`、`account_valuations`：动态账户、角色、估值和归档。
- `categories`、`category_versions`：分类身份与不可变历史名称。
- `cycle_rules`、`cycles`：带生效日期的工资日/自然月规则与生成周期。
- `budget_versions`：SYSTEM、DEFAULT、CYCLE 三层不可变预算快照。
- `operations`：一次用户动作的幂等键和结果。
- `transactions`：唯一事实记录；整数分、实际日期、可选周期归属和关联原交易。
- `audit`：编辑、删除、恢复和校准前后快照。
- `bills`、`bill_occurrences`：固定账单模板与每期实例。
- `allocation_plans`、`allocation_items`：工资分配计划与真实转账关联。
- `imports`、`external_keys`：导入批次和外部唯一键。
- `schema_migrations`：已执行迁移及校验值。

查询索引覆盖交易日期、来源账户、目标账户、周期分类、原交易和列表倒序。删除交易、账户和计划默认软删除/归档；数据库清空是独立危险操作，先建立恢复点。

## 4. 核心不变量

- `amount_minor` 为整数分，范围 ±90,000,000,000.00 元。
- 收入：目标账户 `+amount`；支出：来源账户 `-amount`；转账：来源 `-amount`、目标 `+amount`；退款：目标账户 `+amount` 且抵减原分类净支出。
- 转账没有 `cycle_id` 和分类，不进入收支/储蓄率；同一交易不为统计口径复制。
- 账户余额由期初、交易 movement、校准和最新估值重算。普通账户禁止使可用余额为负；理财估值账户使用市值快照，不从涨跌生成收入。
- 预算执行按 `cycle_id + category_version.category_id` 聚合；统计按 `transaction.date` 的半开区间 `[start,end)` 聚合。
- 历史分类改名新建版本；历史账户改名保留交易外键。任何历史交易修改都会使相关结算标记为 dirty 并重新计算。
- 一次工资分配使用独占事务；全部转账成功才提交。

## 5. 周期规则

预算口径是 `SALARY` 或 `CALENDAR_MONTH`。工资日规则记录 `effective_from`，支持立即、下周期和指定日期；旧周期不改写，新日期生成的周期读取当日有效规则。`transaction_date` 决定交易属于哪个预算周期，`cycle_id` 是写入时匹配结果并在日期修改时重新匹配。

## 6. 备份兼容

跨设备交换使用带版本的 canonical JSON：

```json
{
  "format": "salaryflow-ledger",
  "formatVersion": 1,
  "schemaVersion": 4,
  "createdAt": "ISO-8601",
  "source": { "platform": "android", "appVersion": "0.1.0" },
  "tables": {},
  "integrity": { "algorithm": "SHA-256", "digest": "..." }
}
```

恢复流程依次执行文件大小限制、JSON/schema 校验、ID/外键/金额不变量检查、摘要预览、自动恢复点、临时库导入、完整性检查和原子替换。MVP 只支持整库替换；文件合并必须等操作日志和冲突规则完成后开放。

## 7. 安全与隐私

- 核心账本不申请网络、悬浮窗或旧外部存储权限，不收集分析数据。
- `android:allowBackup=false`，避免 Android 系统把账本自动上传到云端；跨设备只使用用户主动创建的完整备份。
- 全局与单卡金额隐藏已实现；后台遮挡、截图保护、生物识别/PIN 属于 P1，需先确认恢复策略。
- 导出页面说明备份含财务数据；分享由 Android 系统面板完成。
- 发布产物从不含数据库、恢复点和备份文件的源码构建，并核对 APK 权限、签名、架构和 SHA-256。
## 8. 测试

- 领域单元测试：整数金额、算式优先级/除零/舍入、周期边界、时间范围、预算状态。
- 数据库集成测试：收入、支出、转账原子性、退款上限、余额不足、软删除、日期修改、审计、迁移。
- 兼容测试：桌面与 Android 使用同一 JSON 测试向量，备份往返摘要一致。
- UI 测试：首次启动、快速记账、工资分配、清空/恢复、键盘和返回手势。
- 真机矩阵：Android 7/10/13/16，窄屏、普通手机、平板/折叠屏，浅色/深色、大字体。

## 9. 构建与发布

开发使用 Expo Go 验证纯 JS 功能，原生权限及发布包使用 `npx expo run:android` 和 Android Studio。首个发布物是使用 Android 调试证书签署的 ARM64 release 预览 APK，可脱离开发服务器运行；准备商店时必须改用用户持有的正式签名密钥并生成 AAB，同时记录 versionCode、签名摘要、依赖清单和 SHA-256。Windows 构建使用 `scripts/build_android_preview.ps1` 复制干净源码到短英文路径，以避开 NDK/CMake 的中文路径和 260 字符限制。
