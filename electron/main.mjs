import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { Store, json } from "../core/store.mjs";
import { currentSchema } from "../core/migrations.mjs";
import { previewCSV, exportCSV, headers, escapeCell } from "../core/csv.mjs";
import { readLocation, relocate, resetLedgerFiles } from "../core/storage.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
const defaultDirectory = path.join(app.getPath("appData"), "SalaryFlow");
if (process.env.SALARYFLOW_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.SALARYFLOW_DATA_DIR));
else {
  try {
    app.setPath("userData", readLocation(defaultDirectory));
  } catch (e) {
    dialog.showErrorBox("数据目录不可用", e.message);
    app.exit(1);
  }
}
if (!app.requestSingleInstanceLock()) app.quit();
let win,
  store,
  queue = Promise.resolve();
const pendingFiles = new Map();
const testMode = process.env.SALARYFLOW_TEST === "1";
const dataDir = app.getPath("userData");
const english = JSON.parse(
  fs.readFileSync(path.join(root, "../core/locales/en.json"), "utf8"),
);
const ui = (text) =>
  store?.settings().locale === "en" ? (english[text] ?? text) : text;
const backupDir = () =>
  store.settings().backup_directory || path.join(dataDir, "backups");
function refreshMaintenance() {
  if (!store.settings().initialized) return;
  if (store.settings().last_maintenance !== store.clock()) {
    store.command("maintenance", {});
  }
}
async function autoBackup() {
  if (!store?.settings().initialized) return;
  const daily = path.join(dataDir, "backup-status.json");
  let status = {};
  try {
    status = JSON.parse(fs.readFileSync(daily, "utf8"));
  } catch {}
  if (
    status.date === store.clock() &&
    status.revision === store.settings().revision
  )
    return;
  try {
    const b = await store.createBackup(backupDir(), "daily");
    const month = store.clock().slice(0, 7);
    if (status.month !== month)
      await store.createBackup(backupDir(), "monthly");
    fs.writeFileSync(
      daily,
      json({
        date: store.clock(),
        month,
        revision: store.settings().revision,
        file: b.file,
        error: null,
      }),
    );
    pruneBackups();
  } catch (e) {
    fs.writeFileSync(daily, json({ ...status, error: e.message }));
  }
}
function pruneBackups() {
  const dir = backupDir();
  const files = fs
    .readdirSync(dir)
    .filter((x) => x.endsWith(".sqlite.json"))
    .sort()
    .reverse();
  for (const [kind, keep] of [
    ["daily", 30],
    ["monthly", 12],
  ]) {
    const periods = new Set();
    for (const f of files.filter((x) => x.includes("-" + kind + "-"))) {
      const full = path.resolve(dir, f);
      if (path.dirname(full) !== path.resolve(dir)) continue;
      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch {
        continue;
      }
      const period = meta.created_at?.slice(0, kind === "daily" ? 10 : 7);
      if (!period) continue;
      const remove = periods.has(period) || periods.size >= keep;
      periods.add(period);
      if (remove) {
        fs.unlinkSync(full);
        if (fs.existsSync(full.slice(0, -5))) fs.unlinkSync(full.slice(0, -5));
      }
    }
  }
}

async function request(method, p) {
  if (method === "clearCache") {
    await win.webContents.session.clearCache();
    return { ok: true };
  }
  if (method === "resetLedger") {
    const resetPhrase =
      store.settings().locale === "en" ? "START OVER" : "重新开始";
    if (p.confirm !== resetPhrase)
      throw new Error("请输入“重新开始”确认清空账本");
    const answer = await dialog.showMessageBox(win, {
      type: "warning",
      title: ui("重新开始"),
      message: ui("当前账本中的账户、交易、预算和设置将被永久删除。"),
      detail: p.delete_backups
        ? ui("应用管理的本地备份也会一并删除，操作无法撤销。")
        : ui("应用管理的本地备份将保留，可用于恢复。"),
      buttons: [ui("取消"), ui("永久清空")],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (answer.response !== 1) return null;
    const directory = backupDir();
    const ledger = path.join(dataDir, "ledger.sqlite");
    store.close();
    store = null;
    try {
      const result = resetLedgerFiles(
        dataDir,
        directory,
        p.delete_backups === true,
      );
      store = new Store(ledger);
      setTimeout(() => win.reload(), 250);
      return result;
    } catch (error) {
      if (!store) store = new Store(ledger);
      throw error;
    }
  }
  if (method === "chooseDataDirectory") {
    const picked = await dialog.showOpenDialog(win, {
      title: ui("选择数据父目录（创建SalaryFlow-data）"),
      defaultPath:
        process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe")),
      properties: ["openDirectory", "createDirectory"],
    });
    if (picked.canceled) return null;
    const answer = await dialog.showMessageBox(win, {
      type: "question",
      title: ui("迁移数据目录"),
      message: ui(
        "将复制并验证账本及备份，然后重启。原数据保留，已有目标账本不会覆盖。",
      ),
      buttons: [ui("取消"), ui("迁移并重启")],
      defaultId: 0,
      cancelId: 0,
    });
    if (answer.response !== 1) return null;
    const result = await relocate(
      store,
      dataDir,
      picked.filePaths[0],
      defaultDirectory,
    );
    app.relaunch();
    setTimeout(() => win.close(), 300);
    return result;
  }
  if (method === "snapshot") {
    refreshMaintenance();
    return store.snapshot(p);
  }
  if (method === "command") {
    if (["configureBackup", "maintenance"].includes(p.action))
      throw new Error("此操作仅能由应用内部调用");
    const r = store.command(p.action, p.payload, p.operation_id);
    return r;
  }
  if (method === "history") return store.history(p);
  if (method === "budgetHistory")
    return store
      .all(
        "SELECT * FROM budget_versions WHERE scope=? AND cycle_id IS ? ORDER BY version DESC",
        p.scope || "CYCLE",
        p.cycle_id ?? null,
      )
      .map((b) => ({ ...b, items: JSON.parse(b.items) }));
  if (method === "allocationQuote") return store.allocationQuote(p);
  if (method === "dataInfo") {
    let status = {};
    try {
      status = JSON.parse(
        fs.readFileSync(path.join(dataDir, "backup-status.json"), "utf8"),
      );
    } catch {}
    const directory = backupDir();
    const files = fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter((x) => x.endsWith(".sqlite.json"))
          .sort()
          .reverse()
          .slice(0, 60)
      : [];
    return {
      directory: dataDir,
      backup_directory: directory,
      status,
      backups: files.map((name) => {
        try {
          return {
            name: name.slice(0, -5),
            ...JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")),
          };
        } catch {
          return { name, error: "清单读取失败" };
        }
      }),
    };
  }
  if (method === "backup") {
    let dir = backupDir();
    if (p.choose) {
      const r = await dialog.showOpenDialog(win, {
        title: ui("选择备份目录"),
        properties: ["openDirectory", "createDirectory"],
      });
      if (r.canceled) return null;
      dir = r.filePaths[0];
    }
    const r = await store.createBackup(dir);
    return r;
  }
  if (method === "setBackupDirectory") {
    const r = await dialog.showOpenDialog(win, {
      title: ui("自动备份目录"),
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled) return null;
    const dir = r.filePaths[0];
    await store.createBackup(dir);
    store.command("configureBackup", { directory: dir });
    return { directory: dir };
  }
  if (method === "openDataFolder") {
    await shell.openPath(dataDir);
    return true;
  }
  if (method === "restorePreview") {
    const r = await dialog.showOpenDialog(win, {
      title: ui("选择完整备份（将替换当前账本）"),
      filters: [{ name: ui("薪流完整备份"), extensions: ["sqlite", "json"] }],
      properties: ["openFile"],
    });
    if (r.canceled) return null;
    let file = r.filePaths[0];
    if (file.endsWith(".json")) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        data.format !== "salaryflow-full-v1" ||
        typeof data.sqlite_base64 !== "string"
      )
        throw new Error("此JSON不是完整账本数据包");
      const bytes = Buffer.from(data.sqlite_base64, "base64");
      if (createHash("sha256").update(bytes).digest("hex") !== data.checksum)
        throw new Error("数据包校验和错误");
      file = path.join(dataDir, `restore-import-${randomUUID()}.sqlite`);
      fs.writeFileSync(file, bytes);
    }
    const info = Store.verifyFile(file);
    const token = randomUUID();
    pendingFiles.set(token, file);
    return { token, info };
  }
  if (method === "restoreConfirm") {
    const file = pendingFiles.get(p.token);
    if (!file) throw new Error("恢复预览已失效，请重新选择文件");
    const r = await store.restore(file);
    pendingFiles.delete(p.token);
    return r;
  }
  if (method === "importChoose") {
    const r = await dialog.showOpenDialog(win, {
      title: ui("导入 CSV"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
      properties: ["openFile"],
    });
    if (r.canceled) return null;
    const text = fs.readFileSync(r.filePaths[0], "utf8"),
      token = randomUUID();
    pendingFiles.set(token, text);
    return { token, ...previewCSV(store, text) };
  }
  if (method === "importPreview") {
    const text = pendingFiles.get(p.token);
    if (!text) throw new Error("导入预览已失效");
    return previewCSV(store, text, p.mapping);
  }
  if (method === "importCommit") {
    await store.createBackup(backupDir(), "pre-import");
    const r = store.command("commitImport", p.payload, p.operation_id);
    pendingFiles.delete(p.token);
    return r;
  }
  if (method === "export") {
    const format = ["csv", "json", "template"].includes(p.format)
      ? p.format
      : "csv";
    const extension = format === "json" ? "json" : "csv";
    const r = await dialog.showSaveDialog(win, {
      title: ui("导出数据"),
      defaultPath: `薪流-${store.clock()}.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (r.canceled) return null;
    let content;
    if (format === "json") {
      const b = await store.createBackup(undefined, "export");
      const bytes = fs.readFileSync(b.file);
      content = json({
        format: "salaryflow-full-v1",
        created_at: new Date().toISOString(),
        schema_version: currentSchema,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        sqlite_base64: bytes.toString("base64"),
      });
    } else if (format === "template")
      content = "\uFEFF" + headers.map((x) => escapeCell(x)).join(",") + "\r\n";
    else
      content = exportCSV(
        store,
        p.start || "1900-01-01",
        p.end || "2199-12-31",
      );
    fs.writeFileSync(r.filePath, content, "utf8");
    if (format === "csv")
      fs.writeFileSync(
        r.filePath + ".metadata.json",
        json({
          exported_at: new Date().toISOString(),
          timezone: "Asia/Shanghai",
          start: p.start || "1900-01-01",
          end_exclusive: p.end || "2199-12-31",
          refund_policy: "到账日冲减净支出",
          schema_version: currentSchema,
          data_revision: store.settings().revision,
        }),
      );
    return { file: r.filePath };
  }
  throw new Error("请求不可用");
}
app
  .whenReady()
  .then(async () => {
    try {
      store = new Store(path.join(dataDir, "ledger.sqlite"));
    } catch (e) {
      dialog.showErrorBox(
        "账本无法打开",
        `${e.message}\n原数据未被覆盖。请保留数据目录并检查完整备份。\n${dataDir}`,
      );
      app.quit();
    }
    if (store) {
      const index = path.join(root, "../dist/index.html");
      win = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 1024,
        minHeight: 720,
        show: !testMode,
        title: "薪流 SalaryFlow",
        backgroundColor: "#f6f8fa",
        autoHideMenuBar: true,
        icon: path.join(root, "../build/icon.png"),
        webPreferences: {
          preload: path.join(root, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e, url) => {
        if (url !== pathToFileURL(index).href) e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
      );
      ipcMain.handle("salaryflow:request", (event, method, p) => {
        if (
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          !event.senderFrame.url.startsWith(pathToFileURL(index).href)
        )
          throw new Error("请求来源无效");
        const work = queue.then(async () => {
          try {
            return { ok: true, data: await request(method, p ?? {}) };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        });
        queue = work.then(
          () => {},
          () => {},
        );
        return work;
      });
      await win.loadFile(index);
      queue = queue.then(() => autoBackup());
      const timer = setInterval(
        () => {
          queue = queue.then(() => autoBackup()).catch(() => {});
        },
        5 * 60 * 1000,
      );
      timer.unref();
      app.on("second-instance", () => {
        win.show();
        win.focus();
      });
      app.on("window-all-closed", () => {
        queue.finally(() => {
          store?.close();
          app.quit();
        });
      });
    }
  })
  .catch((e) => {
    console.error(e);
    dialog.showErrorBox("启动失败", e.message);
    app.quit();
  });
