import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function readRootWebEnv(): Record<string, string> {
  try {
    const parsed = parseEnv(readFileSync(path.join(repoRoot, ".env"), "utf8"));
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith("VITE_") && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export default defineConfig(() => {
  // Read only VITE_* values from the repository-root .env. Avoid Vite's
  // loadEnv/envDir here: the root .env also contains NODE_ENV=development for
  // the API, which would make production bundles include development paths.
  const fileEnv = readRootWebEnv();
  const apiUrl = process.env.VITE_API_URL ?? fileEnv.VITE_API_URL ?? "/api/v1";

  return {
    plugins: [react(), tailwindcss()],
    envDir: false as const,
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
    },
    server: {
      port: 5174,
      strictPort: true,
    },
    preview: {
      port: 5174,
      strictPort: true,
    },
  };
});
