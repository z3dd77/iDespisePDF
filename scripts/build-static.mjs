import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Produces the static `out/` directory consumed by Electron and Capacitor.
 * Kept separate from `next build` so the server build (and `npm start`) is
 * unaffected.
 */
const cwd = process.cwd();

const sync = spawnSync(process.execPath, [join(cwd, "scripts", "sync-pdf-assets.mjs")], {
  cwd,
  stdio: "inherit",
});
if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

const build = spawnSync(
  process.execPath,
  [join(cwd, "node_modules", "next", "dist", "bin", "next"), "build"],
  {
    cwd,
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "static" },
  },
);
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const required = [
  join(cwd, "out", "index.html"),
  join(cwd, "out", "pdf.worker.min.mjs"),
  join(cwd, "out", "tools", "merge", "index.html"),
];

const missing = required.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`[static] Missing expected output:\n${missing.join("\n")}`);
  process.exit(1);
}

console.log("[static] Static export ready in out/");
