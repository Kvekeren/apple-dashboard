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
};

export default nextConfig;
