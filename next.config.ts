import type { NextConfig } from "next";

/**
 * `BUILD_TARGET=static` produces a fully static `out/` directory for the
 * Electron and Capacitor shells. The normal build stays a Next.js server
 * build so `npm start` keeps working.
 */
const isStaticBuild = process.env.BUILD_TARGET === "static";

const nextConfig: NextConfig = {
  ...(isStaticBuild
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
        cacheComponents: false,
        partialPrefetching: false,
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
      }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
