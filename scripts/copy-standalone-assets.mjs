import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");

function copyDirectory(source, target) {
  if (!existsSync(source) || !existsSync(standaloneDir)) return;
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

copyDirectory(join(root, ".next", "static"), join(standaloneDir, ".next", "static"));
copyDirectory(join(root, "public"), join(standaloneDir, "public"));
