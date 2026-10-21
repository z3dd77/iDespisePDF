import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * npm 11 can skip Electron's postinstall download. Playwright and
 * electron-builder both need the binary, so fetch it once when it is missing.
 */
const packageDir = join(process.cwd(), "node_modules", "electron");
const binary = join(
  packageDir,
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);

if (!existsSync(binary)) {
  console.log("[electron] Binary missing, running install.js");
  const result = spawnSync(process.execPath, [join(packageDir, "install.js")], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
