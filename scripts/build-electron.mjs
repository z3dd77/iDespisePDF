/**
 * Bundles the updater entry point into a single CommonJS file. This keeps
 * `electron-updater` and its dependencies out of the renderer build and out of
 * the packaged `node_modules` tree.
 */
import { build } from "esbuild";

try {
  await build({
    entryPoints: ["electron/updates.mjs"],
    outfile: "electron/updates.bundle.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
    legalComments: "none",
    logLevel: "warning",
  });
  console.log("Bundled electron/updates.bundle.cjs");
} catch (error) {
  console.error(error);
  process.exit(1);
}
