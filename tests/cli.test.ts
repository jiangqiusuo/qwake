import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cli = path.resolve("src/cli.ts");

async function runCli(args: string[], home: string) {
  return execFileAsync(process.execPath, ["--import", "tsx/esm", cli, ...args], {
    env: { ...process.env, QWAKE_HOME: home }
  });
}

describe("CLI", () => {
  it("prints the package version", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      version: string;
    };

    const version = await runCli(["--version"], home);
    expect(version.stdout.trim()).toBe(packageJson.version);
  });

  it("initializes config and queues a mock limit task", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const init = await runCli(["init"], home);
    expect(init.stdout).toContain("Qwake config ready");

    const run = await runCli(["run", "mock", "--limit", "--goal", "Test goal"], home);
    expect(run.stdout).toContain("Limit detected");

    const status = await runCli(["status"], home);
    expect(status.stdout).toContain("queued");
    expect(status.stdout).toContain("Test goal");
  });

  it("resumes the next mock task", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);
    await runCli(
      ["add", "--goal", "Resume me", "--retry-at", "2026-05-30T00:00:00.000Z"],
      home
    );

    const resume = await runCli(["resume", "next"], home);
    expect(resume.stdout).toContain("Resumed");
    const status = await runCli(["status"], home);
    expect(status.stdout).toContain("completed");
  });

  it("runs due mock tasks", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);
    await runCli(["add", "--goal", "Due task", "--retry-at", "2020-01-01T00:00:00.000Z"], home);

    const due = await runCli(["due", "--run"], home);
    expect(due.stdout).toContain("Due tasks: 1");
    expect(due.stdout).toContain("Ran task_");
  });

  it("prints clean doctor output", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const check = await runCli(["doctor"], home);
    expect(check.stdout).toContain("mock: ok (mock)");
    expect(check.stdout).not.toContain("/bin/");
  });

  it("prints structured doctor JSON", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const check = await runCli(["doctor", "--json"], home);
    const payload = JSON.parse(check.stdout);

    expect(payload).toMatchObject({
      home,
      config: path.join(home, "config.yaml")
    });
    expect(payload.agents).toEqual(expect.arrayContaining([
      expect.objectContaining({ agent: "mock", available: true })
    ]));
  });

  it("shows doctor fix option in help", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const help = await runCli(["doctor", "--help"], home);

    expect(help.stdout).toContain("--fix");
  });

  it("supports pnpm-style leading -- before commands", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["--", "init"], home);

    const add = await runCli([
      "--",
      "add",
      "--agent",
      "mock",
      "--goal",
      "Leading dash works",
      "--retry-at",
      "2020-01-01T00:00:00.000Z"
    ], home);
    expect(add.stdout).toContain("Queued");
  });

  it("probes mock availability without queueing a task", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const probe = await runCli(["probe", "mock"], home);
    expect(probe.stdout).toContain("probe agent=mock status=available");

    const status = await runCli(["status"], home);
    expect(status.stdout).toContain("No tasks found.");
  });

  it("wakes mock without queueing a task", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const wake = await runCli(["wake", "mock"], home);
    expect(wake.stdout).toContain("wake agent=mock status=success");

    const status = await runCli(["status"], home);
    expect(status.stdout).toContain("No tasks found.");
  });

  it("prints structured wake JSON", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const wake = await runCli(["wake", "mock", "--json"], home);
    const event = JSON.parse(wake.stdout);
    expect(event).toMatchObject({
      command: "wake",
      agent: "mock",
      status: "success",
      exitCode: 0,
      limited: false
    });
    expect(typeof event.timestamp).toBe("string");
    expect(typeof event.localTimestamp).toBe("string");
    expect(typeof event.durationMs).toBe("number");
  });

  it("keeps wake output quiet except for the structured event", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const wake = await runCli(["wake", "mock"], home);
    expect(wake.stdout).toContain("wake agent=mock status=success");
    expect(wake.stdout).not.toContain("Mock agent completed");
  });

  it("skips smart wake inside the configured window", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    await runCli(["init"], home);

    const first = await runCli(["wake", "mock", "--smart", "--window-minutes", "300", "--buffer-minutes", "5"], home);
    expect(first.stdout).toContain("wake agent=mock status=success");

    const second = await runCli(["wake", "mock", "--smart", "--window-minutes", "300", "--buffer-minutes", "5"], home);
    expect(second.stdout).toContain("wake agent=mock status=skipped");
    expect(second.stdout).toContain("nextWakeAt=");
  });

  it("shows schedule commands in help", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const help = await runCli(["--help"], home);
    expect(help.stdout).toContain("schedule");
  });

  it("shows wake timeout options in help", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const wakeHelp = await runCli(["wake", "--help"], home);
    const scheduleHelp = await runCli(["schedule", "install", "--help"], home);

    expect(wakeHelp.stdout).toContain("--timeout-seconds");
    expect(scheduleHelp.stdout).toContain("--timeout-seconds");
  });

  it("shows multi-agent schedule install usage", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const scheduleHelp = await runCli(["schedule", "install", "--help"], home);

    expect(scheduleHelp.stdout).toContain("<agents...>");
  });

  it("shows schedule doctor, repair, and test commands in help", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const scheduleHelp = await runCli(["schedule", "--help"], home);
    const doctorHelp = await runCli(["schedule", "doctor", "--help"], home);
    const repairHelp = await runCli(["schedule", "repair", "--help"], home);
    const testHelp = await runCli(["schedule", "test", "--help"], home);

    expect(scheduleHelp.stdout).toContain("doctor");
    expect(scheduleHelp.stdout).toContain("repair");
    expect(scheduleHelp.stdout).toContain("test");
    expect(doctorHelp.stdout).toContain("Check system scheduler support");
    expect(repairHelp.stdout).toContain("Repair installed wake schedules");
    expect(repairHelp.stdout).toContain("--all");
    expect(testHelp.stdout).toContain("Test installed wake schedules");
    expect(testHelp.stdout).toContain("--json");
  });

  it("prints structured schedule doctor JSON", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const check = await runCli(["schedule", "doctor", "--json"], home);
    const payload = JSON.parse(check.stdout);

    expect(payload).toMatchObject({
      platform: process.platform,
      available: expect.any(Boolean),
      checks: expect.any(Array)
    });
    expect(payload.schedules).toEqual(expect.any(Array));
    expect(typeof payload.scheduler).toBe("string");
  });

  it("shows fingerprint commands in help", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-cli-"));
    const help = await runCli(["fingerprint", "--help"], home);
    const collectHelp = await runCli(["fingerprint", "collect", "--help"], home);

    expect(help.stdout).toContain("collect");
    expect(help.stdout).toContain("audit");
    expect(collectHelp.stdout).toContain("--api-key-env");
    expect(collectHelp.stdout).toContain("--base-url");
  });
});
