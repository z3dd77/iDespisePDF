/**
 * Next.js prefetches route segments from URLs that only the Next server can
 * answer. A static export has no such endpoint, so the Electron and Capacitor
 * builds opt out of link prefetching; the web build keeps it.
 */
export const linkPrefetch =
  process.env.BUILD_TARGET === "static" ? false : undefined;
