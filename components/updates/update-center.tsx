"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

import { formatBytes } from "@/lib/format";
import type {
  DesktopReleaseNotes,
  DesktopUpdateState,
} from "@/types/idespise-desktop";

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:opacity-60";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/70 bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-raised-xs transition hover:shadow-raised-sm disabled:opacity-60";

/**
 * The preload script installs this object before the page loads and it never
 * changes, so the bridge can be read as an external store. The server snapshot
 * stays null to keep hydration deterministic in the web build.
 */
function subscribeToBridge() {
  return () => {};
}

function getBridgeSnapshot() {
  return typeof window === "undefined"
    ? null
    : (window.idespiseDesktop ?? null);
}

function getServerBridgeSnapshot() {
  return null;
}

function percentOf(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value ?? 0)));
}

function ReleaseNotesBlock({ release }: { release: DesktopReleaseNotes }) {
  return (
    <section aria-labelledby="update-notes-title" className="mt-5">
      <h3
        id="update-notes-title"
        className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-muted"
      >
        Changelog
      </h3>
      {release.notes ? (
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-well bg-sunken/70 p-4 font-sans text-xs leading-relaxed text-ink-muted shadow-inset-sm">
          {release.notes}
        </pre>
      ) : (
        <p className="mt-2 rounded-well bg-sunken/70 p-4 text-xs leading-relaxed text-ink-muted shadow-inset-sm">
          See the release page for the full changelog.
        </p>
      )}
      <a
        href={release.releaseUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full text-xs font-semibold text-accent-strong underline-offset-4 hover:underline"
      >
        View release on GitHub
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    </section>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="mt-3 h-2 overflow-hidden rounded-full bg-sunken shadow-inset-sm"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function UpdateCenter() {
  const bridge = useSyncExternalStore(
    subscribeToBridge,
    getBridgeSnapshot,
    getServerBridgeSnapshot,
  );
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const autoOpened = useRef<string | null>(null);
  const acknowledged = useRef<string | null>(null);

  const applyState = useCallback((next: DesktopUpdateState | null) => {
    if (!next) {
      return;
    }

    setState(next);

    if (next.whatsNew && autoOpened.current !== next.whatsNew.version) {
      autoOpened.current = next.whatsNew.version;
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let active = true;

    void bridge.updates
      .getState()
      .then((next) => {
        if (active) {
          applyState(next);
        }
      })
      .catch(() => {
        // The dialog still opens; the next state event can recover.
      });

    const unsubscribe = bridge.updates.onState((next) => {
      if (active) {
        applyState(next);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyState, bridge]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, bridge]);

  async function runCheck() {
    if (!bridge || !state?.supported || checking) {
      return;
    }

    setChecking(true);
    try {
      applyState(await bridge.updates.check());
    } catch {
      // The main process broadcasts a friendly error state.
    } finally {
      setChecking(false);
    }
  }

  function acknowledge() {
    if (!bridge || !state?.whatsNew) {
      return;
    }
    if (acknowledged.current === state.whatsNew.version) {
      return;
    }

    acknowledged.current = state.whatsNew.version;
    void bridge.updates.acknowledgeWhatsNew();
  }

  function closeDialog() {
    acknowledge();
    setOpen(false);
  }

  function openDialog() {
    setOpen(true);

    if (
      state?.supported &&
      state.status !== "checking" &&
      state.status !== "downloading" &&
      state.status !== "ready"
    ) {
      void runCheck();
    }
  }

  if (!bridge) {
    return null;
  }

  const whatsNew = state?.whatsNew ?? null;
  const release = whatsNew ?? state?.update ?? null;
  const status = state?.status ?? "idle";
  const progress = state?.progress ?? null;
  const percent = percentOf(progress?.percent);
  const busy = status === "checking" || checking;
  const ready = status === "ready";

  const label = ready
    ? "Update ready"
    : status === "downloading"
      ? "Downloading update…"
      : busy
        ? "Checking…"
        : whatsNew
          ? "What's new"
          : "Check for updates";

  let body: ReactNode;

  if (whatsNew) {
    body = (
      <>
        <p className="text-sm leading-relaxed text-ink-muted">
          You are now on version {whatsNew.version}. Here is what changed.
        </p>
        <ReleaseNotesBlock release={whatsNew} />
      </>
    );
  } else if (!state) {
    body = (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Loading update status…
      </p>
    );
  } else if (state.status === "unsupported") {
    body = (
      <p className="text-sm leading-relaxed text-ink-muted">
        {state.message ??
          "Update checks run in the installed Windows app. The browser build is always served fresh."}
      </p>
    );
  } else if (state.status === "checking") {
    body = (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Checking GitHub Releases…
      </p>
    );
  } else if (state.status === "up-to-date") {
    body = (
      <div className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-ready-ink"
        />
        <span>
          You are on the latest version, v{state.currentVersion}. No download is
          needed.
        </span>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-control border border-planned-ink/30 bg-planned-bg/70 px-4 py-3 text-sm leading-relaxed text-planned-ink"
      >
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{state.message ?? "Couldn't check for updates."}</span>
      </div>
    );
  } else if (
    (state.status === "available" || state.status === "downloading") &&
    release
  ) {
    body = (
      <>
        <p className="text-sm leading-relaxed text-ink-muted">
          {state.status === "available"
            ? `Version ${release.version} is available. Starting the download…`
            : `Downloading version ${release.version}…`}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs tabular-nums text-ink-muted">
          <span>{percent}%</span>
          <span>
            {progress && progress.total > 0
              ? `${formatBytes(progress.transferred)} of ${formatBytes(progress.total)}`
              : "Contacting GitHub"}
          </span>
        </div>
        <ProgressBar percent={percent} />
        <ReleaseNotesBlock release={release} />
      </>
    );
  } else if (state.status === "ready" && release) {
    body = (
      <>
        <div className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-ready-ink"
          />
          <span>
            Version {release.version} is ready to install. The app will close,
            install the update, and reopen.
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          If you choose Later, the update installs the next time you quit.
        </p>
        <ReleaseNotesBlock release={release} />
      </>
    );
  } else {
    body = (
      <p className="text-sm leading-relaxed text-ink-muted">
        Check GitHub Releases for a newer Windows build. The current version is
        v{state.currentVersion}.
      </p>
    );
  }

  let actions: ReactNode;

  if (whatsNew) {
    actions = (
      <button type="button" onClick={closeDialog} className={PRIMARY_BUTTON}>
        Got it
      </button>
    );
  } else if (ready) {
    actions = (
      <>
        <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
          Later
        </button>
        <button
          type="button"
          onClick={() => {
            void bridge.updates.install();
          }}
          className={PRIMARY_BUTTON}
        >
          <Download aria-hidden="true" className="size-4" />
          Restart and install
        </button>
      </>
    );
  } else if (status === "available" || status === "downloading") {
    actions = (
      <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
        Later
      </button>
    );
  } else if (status === "checking") {
    actions = (
      <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
        Close
      </button>
    );
  } else if (status === "error") {
    actions = (
      <>
        <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
          Close
        </button>
        <button
          type="button"
          disabled={checking || !state?.supported}
          onClick={() => {
            void runCheck();
          }}
          className={PRIMARY_BUTTON}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </button>
      </>
    );
  } else if (status === "unsupported") {
    actions = (
      <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
        Close
      </button>
    );
  } else if (status === "up-to-date") {
    actions = (
      <>
        <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
          Close
        </button>
        <button
          type="button"
          disabled={checking}
          onClick={() => {
            void runCheck();
          }}
          className={SECONDARY_BUTTON}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Check again
        </button>
      </>
    );
  } else {
    actions = (
      <>
        <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON}>
          Close
        </button>
        <button
          type="button"
          disabled={busy || !state?.supported}
          onClick={() => {
            void runCheck();
          }}
          className={PRIMARY_BUTTON}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Check now
        </button>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs tabular-nums text-ink-faint">
          {state ? `v${state.currentVersion}` : "Desktop"}
        </span>
        <button
          type="button"
          onClick={openDialog}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : ready ? (
            <Download aria-hidden="true" className="size-3.5" />
          ) : (
            <RefreshCw aria-hidden="true" className="size-3.5" />
          )}
          {label}
          {ready ? (
            <span
              aria-hidden="true"
              className="ml-0.5 size-1.5 rounded-full bg-ready-ink"
            />
          ) : null}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="update-dialog-title"
        onClose={closeDialog}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeDialog();
          }
        }}
        className="m-auto w-[min(92vw,40rem)] rounded-card border border-white/70 bg-surface p-0 text-ink shadow-raised-lg backdrop:bg-ink/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line/60 px-6 py-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-control border border-white/70 bg-surface text-accent shadow-raised-xs"
              >
                {whatsNew ? (
                  <Sparkles className="size-5" strokeWidth={1.75} />
                ) : (
                  <RefreshCw className="size-5" strokeWidth={1.75} />
                )}
              </span>
              <div>
                <h2
                  id="update-dialog-title"
                  className="text-base font-semibold text-ink"
                >
                  {whatsNew ? `What's new in v${whatsNew.version}` : "App updates"}
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {state
                    ? `Current version v${state.currentVersion} · Windows desktop`
                    : "Windows desktop"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close update dialog"
              className="rounded-full p-2 text-ink-muted transition hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>

          <div
            className="overflow-y-auto px-6 py-5 text-ink"
          >
            {body}
            <p className="mt-5 text-[0.7rem] leading-relaxed text-ink-faint">
              Update checks contact GitHub Releases. Document files are never
              sent.
            </p>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line/60 px-6 py-4">
            {actions}
          </footer>
        </div>
      </dialog>
    </>
  );
}
