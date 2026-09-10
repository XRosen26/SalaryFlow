import fs from "node:fs";
import path from "node:path";
import { Store } from "./store.mjs";

export function readLocation(defaultDirectory) {
  const config = path.join(defaultDirectory, "location.json");
  if (!fs.existsSync(config)) return defaultDirectory;
  const data = JSON.parse(fs.readFileSync(config, "utf8"));
  if (
    !path.isAbsolute(data.directory) ||
    !fs.existsSync(path.join(data.directory, "ledger.sqlite"))
  )
    throw Error(
      "自定义账本目录不可用，请检查磁盘连接；为避免创建空账本，启动已停止。",
    );
  return data.directory;
}
export async function relocate(store, source, parent, defaultDirectory) {
  const destination = path.resolve(parent, "SalaryFlow-data");
  const relation = path.relative(path.resolve(source), destination);
  if (!relation || (!relation.startsWith("..") && !path.isAbsolute(relation)))
    throw Error("请选择当前数据目录以外的父目录");
  if (fs.existsSync(path.join(destination, "ledger.sqlite")))
    throw Error("目标已有账本，不能覆盖；请选择其他目录");
  fs.mkdirSync(destination, { recursive: true });
  const backup = await store.createBackup(
    path.join(destination, "backups"),
    "relocation",
  );
  Store.verifyFile(backup.file);
  fs.copyFileSync(
    backup.file,
    path.join(destination, "ledger.sqlite"),
    fs.constants.COPYFILE_EXCL,
  );
  Store.verifyFile(path.join(destination, "ledger.sqlite"));
  // Retain existing backups without following subdirectories or overwriting files.
  const oldBackups =
    store.settings().backup_directory || path.join(source, "backups");
  if (fs.existsSync(oldBackups))
    for (const entry of fs.readdirSync(oldBackups, { withFileTypes: true })) {
      if (entry.isFile() && /\.sqlite(?:\.json)?$/.test(entry.name)) {
        const target = path.join(destination, "backups", entry.name);
        if (!fs.existsSync(target))
          fs.copyFileSync(
            path.join(oldBackups, entry.name),
            target,
            fs.constants.COPYFILE_EXCL,
          );
      }
    }
  fs.mkdirSync(defaultDirectory, { recursive: true });
  const config = path.join(defaultDirectory, "location.json");
  fs.writeFileSync(
    config + ".tmp",
    JSON.stringify(
      {
        directory: destination,
        previous: source,
        changed_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  fs.renameSync(config + ".tmp", config);
  return { directory: destination, previous: source };
}
