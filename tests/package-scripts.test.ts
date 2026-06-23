import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package scripts", () => {
  it("provides a release check script", async () => {
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:check"]).toContain("npm run test");
    expect(packageJson.scripts?.["release:check"]).toContain("npm run security:scan");
    expect(packageJson.scripts?.["release:check"]).toContain("npm run typecheck");
    expect(packageJson.scripts?.["release:check"]).toContain("npm run build");
    expect(packageJson.scripts?.["release:check"]).toContain("pnpm --filter qwake-site build");
    expect(packageJson.scripts?.["release:check"]).toContain("npm pack --dry-run");
    expect(packageJson.scripts?.["security:scan"]).toContain("node scripts/security-scan.mjs");
  });
});
