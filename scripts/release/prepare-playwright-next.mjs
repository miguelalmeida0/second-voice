import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const configuredDistDir = process.env.GHOSTWRITER_NEXT_DIST_DIR?.trim();

if (!configuredDistDir || !/^\.tmp\/next-playwright-\d+$/.test(configuredDistDir)) {
  throw new Error(
    `Refusing Playwright cleanup for unexpected distDir: ${configuredDistDir ?? "<missing>"}`,
  );
}

// Always start browser acceptance from a clean, ignored Next build directory.
// Also remove legacy V14-V16 roots so Tailwind cannot accidentally encounter
// generated CSS selectors left by earlier interrupted runs.
await rm(configuredDistDir, { recursive: true, force: true });

for (const entry of await readdir(process.cwd(), { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith(".next-playwright-")) {
    await rm(path.join(process.cwd(), entry.name), { recursive: true, force: true });
  }
}
