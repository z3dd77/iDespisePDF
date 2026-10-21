/**
 * Pure helpers for the desktop updater. Kept free of Electron imports so the
 * release-notes and "what's new" decisions can be unit tested in Node.
 */

export const RELEASE_OWNER = "z3dd77";
export const RELEASE_REPO = "iDespisePDF";
export const MAX_RELEASE_NOTES = 20_000;

/**
 * @param {string} version
 * @param {string} [owner]
 * @param {string} [repo]
 */
export function releaseUrl(
  version,
  owner = RELEASE_OWNER,
  repo = RELEASE_REPO,
) {
  return `https://github.com/${owner}/${repo}/releases/tag/v${encodeURIComponent(version)}`;
}

/**
 * Normalize a GitHub release body for display as plain text.
 *
 * @param {unknown} body
 */
export function normalizeReleaseNotes(body) {
  if (typeof body !== "string") {
    return "";
  }

  const normalized = body.replace(/\r\n?/g, "\n").trim();
  if (normalized.length <= MAX_RELEASE_NOTES) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_RELEASE_NOTES).trimEnd()}\n\n…`;
}

/**
 * @typedef {{
 *   version: string;
 *   notes: string;
 *   releaseUrl: string;
 *   releaseName: string;
 * }} ReleaseNotes
 */

/**
 * @param {string} version
 * @param {unknown} payload
 * @returns {ReleaseNotes}
 */
export function releaseFromApi(version, payload) {
  const record =
    payload !== null && typeof payload === "object"
      ? /** @type {Record<string, unknown>} */ (payload)
      : {};
  const htmlUrl =
    typeof record.html_url === "string" ? record.html_url : releaseUrl(version);
  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name.trim()
      : `v${version}`;

  return {
    version,
    notes: normalizeReleaseNotes(record.body),
    releaseUrl: htmlUrl.startsWith("https://github.com/")
      ? htmlUrl
      : releaseUrl(version),
    releaseName: name,
  };
}

/**
 * Parse the persisted updater state. A UTF-8 BOM is tolerated because the file
 * may be restored, copied, or edited by tooling outside the app.
 *
 * @param {unknown} text
 * @returns {Record<string, unknown>}
 */
export function parseStoredState(text) {
  try {
    const parsed = JSON.parse(String(text).replace(/^\uFEFF/, ""));
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? /** @type {Record<string, unknown>} */ (parsed)
      : {};
  } catch {
    return {};
  }
}

/**
 * @param {unknown} pending
 * @param {string} currentVersion
 * @returns {ReleaseNotes | null}
 */
function normalizePending(pending, currentVersion) {
  if (pending === null || typeof pending !== "object") {
    return null;
  }

  const record = /** @type {Record<string, unknown>} */ (pending);
  if (record.version !== currentVersion) {
    return null;
  }

  return {
    version: currentVersion,
    notes: normalizeReleaseNotes(record.notes),
    releaseUrl:
      typeof record.releaseUrl === "string" &&
      record.releaseUrl.startsWith("https://github.com/")
        ? record.releaseUrl
        : releaseUrl(currentVersion),
    releaseName:
      typeof record.releaseName === "string" &&
      record.releaseName.trim().length > 0
        ? record.releaseName.trim()
        : `v${currentVersion}`,
  };
}

/**
 * Decide whether this launch should show a one-time changelog.
 *
 * @param {unknown} stored
 * @param {string} currentVersion
 * @returns {{
 *   whatsNew: ReleaseNotes | null;
 *   lastRunVersion: string;
 *   needsNotes: boolean;
 * }}
 */
export function planWhatsNew(stored, currentVersion) {
  const record =
    stored !== null && typeof stored === "object"
      ? /** @type {Record<string, unknown>} */ (stored)
      : {};
  const lastRunVersion =
    typeof record.lastRunVersion === "string" ? record.lastRunVersion : null;
  const pending = normalizePending(record.pending, currentVersion);

  if (lastRunVersion === null) {
    return { whatsNew: null, lastRunVersion: currentVersion, needsNotes: false };
  }

  if (lastRunVersion === currentVersion) {
    return { whatsNew: null, lastRunVersion: currentVersion, needsNotes: false };
  }

  if (pending !== null) {
    return {
      whatsNew: pending,
      lastRunVersion: currentVersion,
      needsNotes: false,
    };
  }

  return {
    whatsNew: {
      version: currentVersion,
      notes: "",
      releaseUrl: releaseUrl(currentVersion),
      releaseName: `v${currentVersion}`,
    },
    lastRunVersion: currentVersion,
    needsNotes: true,
  };
}

/**
 * Turn updater/network errors into copy that is safe and useful in the UI.
 *
 * @param {unknown} error
 */
export function friendlyUpdateError(error) {
  const message =
    typeof error === "string"
      ? error
      : error !== null && typeof error === "object" && "message" in error
        ? String(/** @type {{ message?: unknown }} */ (error).message ?? "")
        : "";
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? String(/** @type {{ code?: unknown }} */ (error).code ?? "")
      : "";
  const detail = `${code} ${message}`;

  if (
    /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR/i.test(
      detail,
    )
  ) {
    return "Couldn't reach GitHub. Check your internet connection and try again.";
  }

  if (/latest\.yml|LATEST_YML|no published versions|404/i.test(detail)) {
    return "No update information was found for this release. Try again after the next release is published.";
  }

  if (/rate limit|403/i.test(detail)) {
    return "GitHub is rate-limiting update checks right now. Try again later.";
  }

  if (/signature|sha512|checksum|verify/i.test(detail)) {
    return "The downloaded update could not be verified, so it was not installed.";
  }

  return "Couldn't check for updates. Try again later.";
}
