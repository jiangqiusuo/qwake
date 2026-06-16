import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wakeAgent } from "../src/core.js";

const originalQwakeHome = process.env.QWAKE_HOME;

describe("core wake", () => {
  beforeEach(async () => {
    process.env.QWAKE_HOME = await mkdtemp(path.join(tmpdir(), "qwake-core-"));
  });

  afterEach(() => {
    if (originalQwakeHome === undefined) {
      delete process.env.QWAKE_HOME;
    } else {
      process.env.QWAKE_HOME = originalQwakeHome;
    }
  });

  it("applies the default hard timeout to custom wake calls", async () => {
    const home = process.env.QWAKE_HOME!;
    const scriptDir = path.join(home, "scripts");
    const hangingScript = path.join(scriptDir, "hanging-agent.mjs");
    await mkdir(scriptDir, { recursive: true });
    await writeFile(
      hangingScript,
      "setInterval(() => {}, 1000);\n",
      "utf8"
    );
    await writeFile(
      path.join(home, "config.yaml"),
      [
        "version: 1",
        "retryWindows: ['06:30']",
        "agents:",
        "  custom:",
        `    command: ${JSON.stringify(process.execPath)}`,
        `    args: [${JSON.stringify(hangingScript)}]`,
        "    limitPatterns: []"
      ].join("\n"),
      "utf8"
    );

    const result = await wakeAgent({ agent: "custom", timeoutSeconds: 0.05 });

    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
    expect(result.output).toContain("Timed out after 0.05 seconds.");
  });

  it("skips duplicate wake calls for the same agent", async () => {
    const home = process.env.QWAKE_HOME!;
    const scriptDir = path.join(home, "scripts");
    const slowScript = path.join(scriptDir, "slow-agent.mjs");
    const releaseFile = path.join(home, "release");
    await mkdir(scriptDir, { recursive: true });
    await writeFile(
      slowScript,
      [
        "import { access } from 'node:fs/promises';",
        "process.stdin.resume();",
        "const releaseFile = process.argv[2];",
        "while (true) {",
        "  try {",
        "    await access(releaseFile);",
        "    break;",
        "  } catch {",
        "    await new Promise((resolve) => setTimeout(resolve, 50));",
        "  }",
        "}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(home, "config.yaml"),
      [
        "version: 1",
        "retryWindows: ['06:30']",
        "agents:",
        "  custom:",
        `    command: ${JSON.stringify(process.execPath)}`,
        `    args: [${JSON.stringify(slowScript)}, ${JSON.stringify(releaseFile)}]`,
        "    limitPatterns: []"
      ].join("\n"),
      "utf8"
    );

    const first = wakeAgent({ agent: "custom", timeoutSeconds: 2 });
    await waitForFile(path.join(home, "locks", "custom.lock"));
    const second = await wakeAgent({ agent: "custom", timeoutSeconds: 1 });
    await writeFile(releaseFile, "ok", "utf8");
    const firstResult = await first;

    expect(second).toMatchObject({
      exitCode: 0,
      limited: false,
      skipped: true
    });
    expect(second.output).toContain("already running");
    expect(firstResult.exitCode).toBe(0);
  });
});

async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    try {
      await access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}
