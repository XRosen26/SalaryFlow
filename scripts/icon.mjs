import { spawnSync } from "node:child_process";

const python = process.env.PYTHON || "python";
const result = spawnSync(python, ["scripts/icon.py"], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
