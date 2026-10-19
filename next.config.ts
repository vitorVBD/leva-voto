import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: appDir,
    resolveAlias: {
      react: "./node_modules/react",
      "react/jsx-runtime": "./node_modules/react/jsx-runtime.js",
      "react/jsx-dev-runtime": "./node_modules/react/jsx-dev-runtime.js",
      "react-dom": "./node_modules/react-dom",
      "react-dom/client": "./node_modules/react-dom/client.js",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
