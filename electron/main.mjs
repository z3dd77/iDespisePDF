import { app, BrowserWindow, Menu, net, protocol, session, shell } from "electron";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, extname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const updates = require("./updates.bundle.cjs");

/**
 * Electron shell for the static export in `out/`.
 *
 * The renderer is served over a custom `app://` scheme instead of `file://`
 * so that Next.js client routing, fetch() of RSC payloads, and the PDF.js
 * worker all behave like they do on the web.
 */
const SCHEME = "app";
const HOST = "idespise";
const ROOT = join(app.getAppPath(), "out");

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

function resolveAsset(pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  relative = normalize(relative).replace(/^[/\\]+/, "");
  const base = normalize(ROOT);

  const candidates = [join(base, relative)];
  if (!extname(relative)) {
    candidates.push(join(base, `${relative}.html`));
    candidates.push(join(base, relative, "index.html"));
  }

  for (const candidate of candidates) {
    const resolved = normalize(candidate);
    if (resolved !== base && !resolved.startsWith(base + sep)) {
      continue;
    }
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      return resolved;
    }
  }

  return null;
}

function registerProtocol() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const file = resolveAsset(pathname === "/" ? "/index.html" : pathname);
    if (file === null) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

function uniqueSavePath(directory, fileName) {
  const extension = extname(fileName);
  const stem = basename(fileName, extension);
  let candidate = join(directory, fileName);
  let index = 1;

  while (existsSync(candidate)) {
    candidate = join(directory, `${stem} (${index})${extension}`);
    index += 1;
  }

  return candidate;
}

function configureDownloads() {
  const directory = process.env.IDESPISE_DOWNLOAD_DIR ?? app.getPath("downloads");

  session.defaultSession.on("will-download", (_event, item) => {
    item.setSavePath(uniqueSavePath(directory, item.getFilename()));
    item.once("done", (_doneEvent, state) => {
      if (state === "completed") {
        console.log(`[download] ${item.getSavePath()}`);
      } else {
        console.error(`[download] ${state}: ${item.getSavePath()}`);
      }
    });
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#e7ecf3",
    autoHideMenuBar: true,
    show: false,
    title: "iDespisePDF",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: join(app.getAppPath(), "electron", "preload.cjs"),
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${SCHEME}://${HOST}`)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}`)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void window.loadURL(`${SCHEME}://${HOST}/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });

    registerProtocol();
    configureDownloads();
    updates.registerUpdates();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
