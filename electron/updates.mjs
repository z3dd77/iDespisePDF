import { app, BrowserWindow, ipcMain, net } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { autoUpdater } from "electron-updater";

import {
  RELEASE_OWNER,
  RELEASE_REPO,
  friendlyUpdateError,
  normalizeReleaseNotes,
  parseStoredState,
  planWhatsNew,
  releaseFromApi,
  releaseUrl,
} from "./update-utils.mjs";

const STATE_FILE = "update-state.json";
const RELEASE_API = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases/tags`;

let registered = false;
/** @type {Record<string, unknown> | null} */
let state = null;
let statePath = null;
/** @type {Map<string, ReturnType<typeof releaseFromApi>>} */
const notesCache = new Map();

function feedOverride() {
  const value = process.env.IDESPISE_UPDATE_FEED_URL;
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isSupported() {
  return Boolean(feedOverride()) || app.isPackaged;
}

function readStoredState() {
  try {
    return parseStoredState(readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

/** @param {Record<string, unknown>} value */
function writeStoredState(value) {
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`[updates] could not write state: ${error.message}`);
  }
}

function getState() {
  return state === null ? null : structuredClone(state);
}

function setState(patch) {
  state = { ...state, ...patch };
  const snapshot = getState();

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("updates:state", snapshot);
    }
  }
}

async function fetchReleaseNotes(version) {
  const cached = notesCache.get(version);
  if (cached) {
    return cached;
  }

  const response = await net.fetch(
    `${RELEASE_API}/v${encodeURIComponent(version)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `iDespisePDF/${app.getVersion()}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub release request failed with ${response.status}`);
  }

  const release = releaseFromApi(version, await response.json());
  notesCache.set(version, release);
  return release;
}

function initializeState() {
  statePath = join(app.getPath("userData"), STATE_FILE);
  const stored = readStoredState();
  const plan = planWhatsNew(stored, app.getVersion());
  const nextStored = { ...stored, lastRunVersion: plan.lastRunVersion };

  if (!plan.whatsNew || plan.needsNotes) {
    delete nextStored.pending;
  }

  writeStoredState(nextStored);

  const supported = isSupported();
  state = {
    supported,
    currentVersion: app.getVersion(),
    platform: process.platform,
    status: supported ? "idle" : "unsupported",
    update: null,
    progress: null,
    message: supported
      ? null
      : "Update checks run in the installed Windows app.",
    whatsNew: plan.whatsNew,
  };

  if (plan.needsNotes && plan.whatsNew) {
    const version = plan.whatsNew.version;
    void fetchReleaseNotes(version)
      .then((release) => {
        if (state?.whatsNew?.version !== version) {
          return;
        }
        setState({ whatsNew: release });
        writeStoredState({ ...readStoredState(), pending: release });
      })
      .catch((error) => {
        console.warn(`[updates] release notes unavailable: ${error.message}`);
      });
  }
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(100, Math.max(0, number));
}

async function hydrateReleaseNotes(version) {
  try {
    const release = await fetchReleaseNotes(version);
    if (state?.update?.version !== version) {
      return;
    }
    setState({ update: release });
  } catch (error) {
    console.warn(`[updates] release notes unavailable: ${error.message}`);
  }
}

async function startDownload() {
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error(`[updates] download failed: ${error?.stack ?? error}`);
    if (state?.status !== "ready") {
      setState({ status: "error", message: friendlyUpdateError(error) });
    }
  }
}

function handleAvailable(info) {
  if (state?.status === "downloading" || state?.status === "ready") {
    return;
  }

  const version = info.version;
  setState({
    status: "available",
    update: {
      version,
      notes: normalizeReleaseNotes(info.releaseNotes),
      releaseUrl: releaseUrl(version),
      releaseName:
        typeof info.releaseName === "string" && info.releaseName.trim()
          ? info.releaseName.trim()
          : `v${version}`,
    },
    progress: null,
    message: null,
  });

  void hydrateReleaseNotes(version);
  void startDownload();
}

function handleDownloaded(info) {
  const version = info.version;
  const release =
    state?.update?.version === version
      ? state.update
      : {
          version,
          notes: normalizeReleaseNotes(info.releaseNotes),
          releaseUrl: releaseUrl(version),
          releaseName: `v${version}`,
        };
  const previousProgress = state?.progress ?? {
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
  };

  writeStoredState({ ...readStoredState(), pending: release });
  setState({
    status: "ready",
    update: release,
    progress: { ...previousProgress, percent: 100 },
    message: null,
  });
}

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = {
    info: (message) => console.log(`[updates] ${message}`),
    warn: (message) => console.warn(`[updates] ${message}`),
    error: (message) => console.error(`[updates] ${message}`),
    debug: (message) => console.debug(`[updates] ${message}`),
  };

  const override = feedOverride();
  if (override) {
    autoUpdater.setFeedURL({ provider: "generic", url: override });
  }
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.on("checking-for-update", () => {
    setState({
      status: "checking",
      update: null,
      progress: null,
      message: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    handleAvailable(info);
  });

  autoUpdater.on("update-not-available", () => {
    setState({
      status: "up-to-date",
      update: null,
      progress: null,
      message: null,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setState({
      status: "downloading",
      progress: {
        percent: clampPercent(progress.percent),
        transferred: Number(progress.transferred) || 0,
        total: Number(progress.total) || 0,
        bytesPerSecond: Number(progress.bytesPerSecond) || 0,
      },
      message: null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    handleDownloaded(info);
  });

  autoUpdater.on("error", (error) => {
    console.error(`[updates] ${error?.stack ?? error}`);
    if (state?.status === "ready") {
      return;
    }
    setState({ status: "error", message: friendlyUpdateError(error) });
  });
}

async function check() {
  if (!state?.supported) {
    return getState();
  }
  if (
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "ready"
  ) {
    return getState();
  }

  setState({
    status: "checking",
    update: null,
    progress: null,
    message: null,
  });

  try {
    await autoUpdater.checkForUpdates();
    if (state?.status === "checking") {
      setState({
        status: "up-to-date",
        update: null,
        progress: null,
        message: null,
      });
    }
  } catch (error) {
    console.error(`[updates] check failed: ${error?.stack ?? error}`);
    setState({ status: "error", message: friendlyUpdateError(error) });
  }

  return getState();
}

async function download() {
  if (!state?.supported || !state.update) {
    return getState();
  }
  if (state.status === "downloading" || state.status === "ready") {
    return getState();
  }

  setState({
    status: "downloading",
    progress: {
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0,
    },
    message: null,
  });

  await startDownload();
  return getState();
}

function install() {
  if (!state || state.status !== "ready") {
    return;
  }

  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(true, true);
    } catch (error) {
      console.error(`[updates] install failed: ${error?.stack ?? error}`);
      setState({ status: "error", message: friendlyUpdateError(error) });
    }
  });
}

function acknowledgeWhatsNew() {
  if (!state?.whatsNew) {
    return;
  }

  setState({ whatsNew: null });

  const stored = readStoredState();
  if (stored.pending) {
    delete stored.pending;
    writeStoredState(stored);
  }
}

export function registerUpdates() {
  if (registered) {
    return;
  }
  registered = true;

  initializeState();

  ipcMain.handle("updates:get-state", () => getState());
  ipcMain.handle("updates:check", () => check());
  ipcMain.handle("updates:download", () => download());
  ipcMain.handle("updates:install", () => install());
  ipcMain.handle("updates:ack-whats-new", () => acknowledgeWhatsNew());

  if (state?.supported) {
    configureUpdater();
  }
}
