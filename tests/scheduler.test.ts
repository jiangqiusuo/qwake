import { describe, expect, it } from "vitest";
import {
  buildLinuxScheduleLabel,
  buildCronLine,
  buildSystemdServiceUnit,
  buildSystemdTimerUnit,
  buildWindowsCreateTaskArgs,
  buildWindowsTaskName,
  normalizeTimes,
  renderLinuxCronScript,
  renderWindowsScheduleScript
} from "../src/scheduler.js";

describe("scheduler", () => {
  it("normalizes comma-separated wake times", () => {
    expect(normalizeTimes(["11:00,06:00", "21:00"])).toEqual(["06:00", "11:00", "21:00"]);
  });

  it("rejects invalid wake times", () => {
    expect(() => normalizeTimes(["25:00"])).toThrow("Invalid time");
  });

  it("deduplicates wake times", () => {
    expect(normalizeTimes(["06:00,06:00", "11:00"])).toEqual(["06:00", "11:00"]);
  });

  it("builds stable Windows scheduled task names", () => {
    expect(buildWindowsTaskName("codex", "06:05")).toBe("\\Qwake\\codex-0605");
  });

  it("builds schtasks create arguments for Windows", () => {
    expect(buildWindowsCreateTaskArgs({
      taskName: "\\Qwake\\codex-0605",
      scriptPath: "E:\\Qwake\\.qwake\\schedules\\qwake-codex.cmd",
      time: "06:05"
    })).toEqual([
      "/Create",
      "/TN",
      "\\Qwake\\codex-0605",
      "/SC",
      "DAILY",
      "/ST",
      "06:05",
      "/TR",
      "\"E:\\Qwake\\.qwake\\schedules\\qwake-codex.cmd\"",
      "/F"
    ]);
  });

  it("renders a Windows schedule wrapper script with logs", () => {
    const script = renderWindowsScheduleScript({
      cwd: "E:\\Project\\qwake",
      logPath: "E:\\Project\\qwake\\.qwake\\logs\\codex.log",
      errorLogPath: "E:\\Project\\qwake\\.qwake\\logs\\codex.error.log",
      programArguments: ["node", "E:\\Project\\qwake\\dist\\cli.js", "wake", "codex", "--smart"]
    });

    expect(script).toContain("cd /d \"E:\\Project\\qwake\"");
    expect(script).toContain("\"node\" \"E:\\Project\\qwake\\dist\\cli.js\" \"wake\" \"codex\" \"--smart\"");
    expect(script).toContain(">> \"E:\\Project\\qwake\\.qwake\\logs\\codex.log\"");
    expect(script).toContain("2>> \"E:\\Project\\qwake\\.qwake\\logs\\codex.error.log\"");
  });

  it("builds stable Linux systemd schedule labels", () => {
    expect(buildLinuxScheduleLabel("codex")).toBe("qwake-codex");
  });

  it("renders a Linux systemd service unit", () => {
    const unit = buildSystemdServiceUnit({
      description: "Qwake codex wake",
      cwd: "/home/demo/qwake",
      logPath: "/home/demo/.qwake/logs/codex.log",
      errorLogPath: "/home/demo/.qwake/logs/codex.error.log",
      environment: {
        QWAKE_HOME: "/home/demo/.qwake",
        PATH: "/usr/bin:/bin"
      },
      programArguments: ["node", "/home/demo/qwake/dist/cli.js", "wake", "codex", "--smart"]
    });

    expect(unit).toContain("Description=Qwake codex wake");
    expect(unit).toContain("WorkingDirectory=/home/demo/qwake");
    expect(unit).toContain("Environment=\"QWAKE_HOME=/home/demo/.qwake\"");
    expect(unit).toContain("ExecStart=\"node\" \"/home/demo/qwake/dist/cli.js\" \"wake\" \"codex\" \"--smart\"");
    expect(unit).toContain("StandardOutput=append:/home/demo/.qwake/logs/codex.log");
    expect(unit).toContain("StandardError=append:/home/demo/.qwake/logs/codex.error.log");
  });

  it("renders a Linux systemd timer unit with multiple times", () => {
    const unit = buildSystemdTimerUnit({
      description: "Qwake codex wake timer",
      serviceName: "qwake-codex.service",
      times: ["06:05", "11:10", "16:15", "21:20"]
    });

    expect(unit).toContain("Description=Qwake codex wake timer");
    expect(unit).toContain("Unit=qwake-codex.service");
    expect(unit).toContain("OnCalendar=*-*-* 06:05:00");
    expect(unit).toContain("OnCalendar=*-*-* 21:20:00");
    expect(unit).toContain("Persistent=true");
  });

  it("renders a Linux cron wrapper script with logs", () => {
    const script = renderLinuxCronScript({
      cwd: "/home/demo/qwake",
      logPath: "/home/demo/.qwake/logs/codex.log",
      errorLogPath: "/home/demo/.qwake/logs/codex.error.log",
      environment: {
        QWAKE_HOME: "/home/demo/.qwake"
      },
      programArguments: ["node", "/home/demo/qwake/dist/cli.js", "wake", "codex", "--smart"]
    });

    expect(script).toContain("cd \"/home/demo/qwake\"");
    expect(script).toContain("QWAKE_HOME=\"/home/demo/.qwake\"");
    expect(script).toContain("\"node\" \"/home/demo/qwake/dist/cli.js\" \"wake\" \"codex\" \"--smart\"");
    expect(script).toContain(">> \"/home/demo/.qwake/logs/codex.log\"");
    expect(script).toContain("2>> \"/home/demo/.qwake/logs/codex.error.log\"");
  });

  it("renders a cron line for a daily HH:mm schedule", () => {
    expect(buildCronLine({
      time: "06:05",
      scriptPath: "/home/demo/.qwake/schedules/qwake-codex.sh",
      label: "QWAKE:codex"
    })).toBe("5 6 * * * /bin/sh \"/home/demo/.qwake/schedules/qwake-codex.sh\" # QWAKE:codex");
  });
});
