import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Pin tracing/Turbopack root to this app. Without this, Next.js may infer
  // ~/package-lock.json as the monorepo root and resolve CSS imports from the wrong folder.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return {
      afterFiles: [
        { source: "/agenda-concepten/", destination: "/agenda-concepten/01-zwembanen.html" },
        { source: "/agenda-styling", destination: "/agenda-styling/index.html" },
        { source: "/agenda-styling/", destination: "/agenda-styling/index.html" },
      ],
    };
  },
  // Cache-bestanden in data/ niet laten mee-triggeren voor dev-rebuilds
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/data/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
