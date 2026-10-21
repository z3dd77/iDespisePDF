export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error"
  | "unsupported";

export type DesktopReleaseNotes = {
  version: string;
  notes: string;
  releaseUrl: string;
  releaseName: string;
};

export type DesktopUpdateProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export type DesktopUpdateState = {
  supported: boolean;
  currentVersion: string;
  platform: string;
  status: DesktopUpdateStatus;
  update: DesktopReleaseNotes | null;
  progress: DesktopUpdateProgress | null;
  message: string | null;
  whatsNew: DesktopReleaseNotes | null;
};

export type IDespiseDesktop = {
  platform: string;
  updates: {
    getState: () => Promise<DesktopUpdateState>;
    check: () => Promise<DesktopUpdateState>;
    download: () => Promise<DesktopUpdateState>;
    install: () => Promise<void>;
    acknowledgeWhatsNew: () => Promise<void>;
    onState: (callback: (state: DesktopUpdateState) => void) => () => void;
  };
};

declare global {
  interface Window {
    idespiseDesktop?: IDespiseDesktop;
  }
}
