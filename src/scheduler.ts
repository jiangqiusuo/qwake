import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { atomicWriteFile } from "./fs-utils.js";
import { DEFAULT_WAKE_TIMEOUT_SECONDS } from "./config.js";
import { getQwakeHome } from "./paths.js";
import type { AgentName } from "./types.js";
import { parseWindow } from "./windows.js";

export interface InstalledSchedule {
  agent: AgentName;
  label: string;
  plistPath: string;
  schedulerKind?: "launchd" | "schtasks" | "systemd" | "cron";
  scriptPath?: string;
  metadataPath?: string;
  servicePath?: string;
  timerPath?: string;
  logPath: string;
  errorLogPath: string;
  times: string[];
  budgetUsd?: string;
  command?: string;
  smart?: boolean;
  windowMinutes?: number;
  bufferMinutes?: number;
  timeoutSeconds?: number;
}

export interface SchedulerDoctorCheck {
  name: string;
  available: boolean;
  detail?: string;
}

export interface ScheduleExistenceCheck {
  name: string;
  command: string;
  args: string[];
  availableLabel: string;
  missingLabel: string;
  outputIncludes?: string;
}

export interface SchedulerDoctorResult {
  platform: NodeJS.Platform;
  scheduler: "launchd" | "schtasks" | "systemd" | "cron" | "unsupported";
  available: boolean;
  checks: SchedulerDoctorCheck[];
  schedules: InstalledSchedule[];
}

export async function installSchedule(input: {
  agent: AgentName;
  times: string[];
  budgetUsd?: string;
  command?: string;
  cwd?: string;
  smart?: boolean;
  windowMinutes?: number;
  bufferMinutes?: number;
  timeoutSeconds?: number;
}): Promise<InstalledSchedule> {
  if (process.platform === "win32") {
    return installWindowsSchedule(input);
  }
  if (process.platform === "linux") {
    return installLinuxSchedule(input);
  }
  assertMacOS();
  const times = normalizeTimes(input.times);
  const schedule = getSchedulePaths(input.agent);
  const programArguments = buildProgramArguments({
    command: input.command,
    agent: input.agent,
    budgetUsd: input.budgetUsd,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  });

  await mkdir(path.dirname(schedule.plistPath), { recursive: true });
  await mkdir(path.dirname(schedule.logPath), { recursive: true });

  const plist = renderLaunchAgentPlist({
    label: schedule.label,
    cwd: input.cwd || process.cwd(),
    programArguments,
    times,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    environment: buildLaunchEnvironment()
  });

  if (existsSync(schedule.plistPath)) {
    await unloadLaunchAgent(schedule.plistPath);
  }
  await atomicWriteFile(schedule.plistPath, plist);
  await loadLaunchAgent(schedule.plistPath);
  return {
    agent: input.agent,
    label: schedule.label,
    plistPath: schedule.plistPath,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    times,
    budgetUsd: input.budgetUsd,
    command: input.command,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  };
}

export async function uninstallSchedule(agent: AgentName): Promise<InstalledSchedule | undefined> {
  if (process.platform === "win32") {
    return uninstallWindowsSchedule(agent);
  }
  if (process.platform === "linux") {
    return uninstallLinuxSchedule(agent);
  }
  assertMacOS();
  const schedule = getSchedulePaths(agent);
  if (!existsSync(schedule.plistPath)) {
    return undefined;
  }
  const times = await readScheduleTimes(schedule.plistPath);
  await unloadLaunchAgent(schedule.plistPath);
  await rm(schedule.plistPath, { force: true });
  return {
    agent,
    label: schedule.label,
    plistPath: schedule.plistPath,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    times
  };
}

export async function repairSchedule(agent: AgentName): Promise<InstalledSchedule> {
  const schedules = await scheduleStatus(agent);
  const existing = schedules[0];
  if (!existing) {
    throw new Error(`No wake schedule metadata found for ${agent}. Run schedule install first.`);
  }
  return installSchedule({
    agent,
    times: existing.times,
    budgetUsd: existing.budgetUsd,
    command: existing.command,
    smart: existing.smart,
    windowMinutes: existing.windowMinutes,
    bufferMinutes: existing.bufferMinutes,
    timeoutSeconds: existing.timeoutSeconds
  });
}

export async function scheduleStatus(agent?: AgentName): Promise<InstalledSchedule[]> {
  if (process.platform === "win32") {
    return windowsScheduleStatus(agent);
  }
  if (process.platform === "linux") {
    return linuxScheduleStatus(agent);
  }
  assertMacOS();
  const agents: AgentName[] = agent ? [agent] : ["codex", "claude", "mock", "custom"];
  const schedules: InstalledSchedule[] = [];
  for (const item of agents) {
    const schedule = getSchedulePaths(item);
    if (!existsSync(schedule.plistPath)) {
      continue;
    }
    schedules.push({
      agent: item,
      label: schedule.label,
      plistPath: schedule.plistPath,
      logPath: schedule.logPath,
      errorLogPath: schedule.errorLogPath,
      times: await readScheduleTimes(schedule.plistPath)
    });
  }
  return schedules;
}

export async function readScheduleLogs(agent?: AgentName, lines = 50): Promise<string> {
  const agents: AgentName[] = agent ? [agent] : ["codex", "claude", "mock", "custom"];
  const chunks: string[] = [];
  for (const item of agents) {
    const schedule = getSchedulePaths(item);
    for (const file of [schedule.logPath, schedule.errorLogPath]) {
      if (!existsSync(file)) {
        continue;
      }
      const content = await readFile(file, "utf8");
      const tail = content.trim().split(/\r?\n/).slice(-lines).join("\n");
      if (tail) {
        chunks.push(`==> ${file}\n${tail}`);
      }
    }
  }
  return chunks.join("\n\n");
}

export async function runScheduleNow(agent: AgentName): Promise<InstalledSchedule> {
  if (process.platform === "win32") {
    const schedules = await scheduleStatus(agent);
    const schedule = schedules[0];
    if (!schedule) {
      throw new Error(`No wake schedule installed for ${agent}.`);
    }
    await schtasks(["/Run", "/TN", buildWindowsTaskName(agent, schedule.times[0])]);
    return schedule;
  }
  if (process.platform === "linux") {
    const schedules = await scheduleStatus(agent);
    const schedule = schedules[0];
    if (!schedule) {
      throw new Error(`No wake schedule installed for ${agent}.`);
    }
    if (schedule.schedulerKind === "cron" && schedule.scriptPath) {
      await shellScript(["/bin/sh", schedule.scriptPath]);
    } else {
      await systemctlUser(["start", `${buildLinuxScheduleLabel(agent)}.service`]);
    }
    return schedule;
  }
  assertMacOS();
  const schedules = await scheduleStatus(agent);
  const schedule = schedules[0];
  if (!schedule) {
    throw new Error(`No wake schedule installed for ${agent}.`);
  }
  await launchctl(["start", schedule.label]);
  return schedule;
}

export function normalizeTimes(times: string[]): string[] {
  const normalized = times.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error("At least one time is required. Example: --times 06:00,11:00,16:00,21:00");
  }
  for (const time of normalized) {
    if (!parseWindow(time)) {
      throw new Error(`Invalid time "${time}". Use HH:mm, for example 06:00.`);
    }
  }
  return [...new Set(normalized)].sort();
}

function getSchedulePaths(agent: AgentName): Omit<InstalledSchedule, "agent" | "times"> {
  const label = `com.qwake.${agent}`;
  const logsDir = path.join(getQwakeHome(), "logs");
  const schedulesDir = path.join(getQwakeHome(), "schedules");
  const systemdDir = path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "systemd", "user");
  const linuxLabel = buildLinuxScheduleLabel(agent);
  return {
    label,
    plistPath: path.join(homedir(), "Library", "LaunchAgents", `${label}.plist`),
    scriptPath: path.join(schedulesDir, `qwake-${agent}.cmd`),
    metadataPath: path.join(schedulesDir, `${agent}.json`),
    servicePath: path.join(systemdDir, `${linuxLabel}.service`),
    timerPath: path.join(systemdDir, `${linuxLabel}.timer`),
    logPath: path.join(logsDir, `${agent}.log`),
    errorLogPath: path.join(logsDir, `${agent}.error.log`)
  };
}

export async function scheduleDoctor(agent?: AgentName): Promise<SchedulerDoctorResult> {
  const schedules = await scheduleStatus(agent);
  if (process.platform === "darwin") {
    const launchctlAvailable = await commandAvailable("launchctl");
    return {
      platform: process.platform,
      scheduler: "launchd",
      available: launchctlAvailable && await schedulesExist(schedules),
      checks: [
        { name: "launchctl", available: launchctlAvailable },
        ...await runScheduleExistenceChecks(schedules)
      ],
      schedules
    };
  }
  if (process.platform === "win32") {
    const schtasksAvailable = await commandAvailable("schtasks.exe");
    return {
      platform: process.platform,
      scheduler: "schtasks",
      available: schtasksAvailable && await schedulesExist(schedules),
      checks: [
        { name: "schtasks.exe", available: schtasksAvailable },
        ...await runScheduleExistenceChecks(schedules)
      ],
      schedules
    };
  }
  if (process.platform === "linux") {
    const systemdAvailable = await hasLinuxSystemd();
    const cronAvailable = await commandAvailable("crontab");
    const scheduleChecks = await runScheduleExistenceChecks(schedules);
    return {
      platform: process.platform,
      scheduler: systemdAvailable ? "systemd" : cronAvailable ? "cron" : "unsupported",
      available: (systemdAvailable || cronAvailable) && scheduleChecks.every((check) => check.available),
      checks: [
        { name: "systemctl --user", available: systemdAvailable },
        { name: "crontab", available: cronAvailable },
        ...scheduleChecks
      ],
      schedules
    };
  }
  return {
    platform: process.platform,
    scheduler: "unsupported",
    available: false,
    checks: [],
    schedules
  };
}

export function buildScheduleExistenceChecks(input: {
  platform: NodeJS.Platform;
  schedule: InstalledSchedule;
}): ScheduleExistenceCheck[] {
  const { platform, schedule } = input;
  if (platform === "darwin") {
    return [{
      name: `launchd ${schedule.label}`,
      command: "launchctl",
      args: ["list", schedule.label],
      availableLabel: "loaded",
      missingLabel: "not loaded"
    }];
  }
  if (platform === "win32") {
    return schedule.times.map((time) => {
      const taskName = buildWindowsTaskName(schedule.agent, time);
      return {
        name: `schtasks ${taskName}`,
        command: "schtasks.exe",
        args: ["/Query", "/TN", taskName],
        availableLabel: "installed",
        missingLabel: "missing"
      };
    });
  }
  if (platform === "linux" && schedule.schedulerKind === "cron") {
    return [{
      name: `cron QWAKE:${schedule.agent}`,
      command: "crontab",
      args: ["-l"],
      availableLabel: "installed",
      missingLabel: "missing",
      outputIncludes: `# QWAKE:${schedule.agent}`
    }];
  }
  if (platform === "linux") {
    const timerName = schedule.timerPath ? path.basename(schedule.timerPath) : `${buildLinuxScheduleLabel(schedule.agent)}.timer`;
    return [{
      name: `systemd ${timerName}`,
      command: "systemctl",
      args: ["--user", "is-enabled", timerName],
      availableLabel: "enabled",
      missingLabel: "disabled or missing"
    }];
  }
  return [];
}

function buildProgramArguments(input: {
  command?: string;
  agent: AgentName;
  budgetUsd?: string;
  smart?: boolean;
  windowMinutes?: number;
  bufferMinutes?: number;
  timeoutSeconds?: number;
}): string[] {
  const base = input.command
    ? [input.command]
    : [process.execPath, process.argv[1] || path.resolve("dist/cli.js")];
  const args = [...base, "wake", input.agent];
  if (input.smart) {
    args.push("--smart");
  }
  if (input.windowMinutes !== undefined) {
    args.push("--window-minutes", String(input.windowMinutes));
  }
  if (input.bufferMinutes !== undefined) {
    args.push("--buffer-minutes", String(input.bufferMinutes));
  }
  if (input.timeoutSeconds !== undefined) {
    args.push("--timeout-seconds", String(input.timeoutSeconds));
  }
  if (input.budgetUsd) {
    args.push("--budget-usd", input.budgetUsd);
  }
  return args;
}

function buildLaunchEnvironment(): Record<string, string> {
  return {
    PATH: process.env.PATH || "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: homedir(),
    SHELL: process.env.SHELL || "/bin/zsh"
  };
}

async function installWindowsSchedule(input: {
  agent: AgentName;
  times: string[];
  budgetUsd?: string;
  command?: string;
  cwd?: string;
  smart?: boolean;
  windowMinutes?: number;
  bufferMinutes?: number;
  timeoutSeconds?: number;
}): Promise<InstalledSchedule> {
  const times = normalizeTimes(input.times);
  const schedule = getSchedulePaths(input.agent);
  if (!schedule.scriptPath || !schedule.metadataPath) {
    throw new Error("Windows schedule script path is missing.");
  }
  const cwd = input.cwd || process.cwd();
  const programArguments = buildProgramArguments({
    command: input.command,
    agent: input.agent,
    budgetUsd: input.budgetUsd,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  });

  await mkdir(path.dirname(schedule.scriptPath), { recursive: true });
  await mkdir(path.dirname(schedule.logPath), { recursive: true });
  await atomicWriteFile(schedule.scriptPath, renderWindowsScheduleScript({
    cwd,
    programArguments,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath
  }));

  for (const time of times) {
    await schtasks(buildWindowsCreateTaskArgs({
      taskName: buildWindowsTaskName(input.agent, time),
      scriptPath: schedule.scriptPath,
      time
    }));
  }
  await atomicWriteFile(schedule.metadataPath, JSON.stringify({
    agent: input.agent,
    label: buildWindowsTaskLabel(input.agent),
    scriptPath: schedule.scriptPath,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    times,
    budgetUsd: input.budgetUsd,
    command: input.command,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  }, null, 2));

  return {
    agent: input.agent,
    label: buildWindowsTaskLabel(input.agent),
    plistPath: "",
    schedulerKind: "schtasks",
    scriptPath: schedule.scriptPath,
    metadataPath: schedule.metadataPath,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    times,
    budgetUsd: input.budgetUsd,
    command: input.command,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  };
}

async function uninstallWindowsSchedule(agent: AgentName): Promise<InstalledSchedule | undefined> {
  const schedules = await windowsScheduleStatus(agent);
  if (schedules.length === 0) {
    return undefined;
  }
  const schedule = schedules[0];
  for (const time of schedule.times) {
    await schtasks(["/Delete", "/TN", buildWindowsTaskName(agent, time), "/F"], true);
  }
  if (schedule.scriptPath) {
    await rm(schedule.scriptPath, { force: true });
  }
  if (schedule.metadataPath) {
    await rm(schedule.metadataPath, { force: true });
  }
  return schedule;
}

async function windowsScheduleStatus(agent?: AgentName): Promise<InstalledSchedule[]> {
  const agents: AgentName[] = agent ? [agent] : ["codex", "claude", "mock", "custom"];
  const schedules: InstalledSchedule[] = [];
  for (const item of agents) {
    const schedule = await readWindowsScheduleMetadata(item);
    if (schedule) {
      schedules.push(schedule);
    }
  }
  return schedules;
}

async function readWindowsScheduleMetadata(agent: AgentName): Promise<InstalledSchedule | undefined> {
  const schedule = getSchedulePaths(agent);
  if (!schedule.metadataPath || !existsSync(schedule.metadataPath)) {
    return undefined;
  }
  try {
    const raw = await readFile(schedule.metadataPath, "utf8");
    const parsed = JSON.parse(raw) as {
      label?: string;
      scriptPath?: string;
      logPath?: string;
      errorLogPath?: string;
      times?: string[];
      budgetUsd?: string;
      command?: string;
      smart?: boolean;
      windowMinutes?: number;
      bufferMinutes?: number;
      timeoutSeconds?: number;
    };
    if (!parsed.times?.length) {
      return undefined;
    }
    return {
      agent,
      label: parsed.label || buildWindowsTaskLabel(agent),
      plistPath: "",
      scriptPath: parsed.scriptPath || schedule.scriptPath,
      metadataPath: schedule.metadataPath,
      logPath: parsed.logPath || schedule.logPath,
      errorLogPath: parsed.errorLogPath || schedule.errorLogPath,
      times: normalizeTimes(parsed.times),
      budgetUsd: parsed.budgetUsd,
      command: parsed.command,
      smart: parsed.smart,
      windowMinutes: parsed.windowMinutes,
      bufferMinutes: parsed.bufferMinutes,
      timeoutSeconds: parsed.timeoutSeconds
    };
  } catch {
    return undefined;
  }
}

export function buildWindowsTaskLabel(agent: AgentName): string {
  return `Qwake ${agent}`;
}

export function buildWindowsTaskName(agent: AgentName, time: string): string {
  return `\\Qwake\\${agent}-${time.replace(":", "")}`;
}

export function buildWindowsCreateTaskArgs(input: {
  taskName: string;
  scriptPath: string;
  time: string;
}): string[] {
  return [
    "/Create",
    "/TN",
    input.taskName,
    "/SC",
    "DAILY",
    "/ST",
    input.time,
    "/TR",
    `"${input.scriptPath}"`,
    "/F"
  ];
}

export function renderWindowsScheduleScript(input: {
  cwd: string;
  programArguments: string[];
  logPath: string;
  errorLogPath: string;
}): string {
  return `@echo off\r
setlocal\r
cd /d "${input.cwd}"\r
${quoteWindowsCommand(input.programArguments)} >> "${input.logPath}" 2>> "${input.errorLogPath}"\r
exit /b %ERRORLEVEL%\r
`;
}

function quoteWindowsCommand(args: string[]): string {
  return args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`).join(" ");
}

async function installLinuxSchedule(input: {
  agent: AgentName;
  times: string[];
  budgetUsd?: string;
  command?: string;
  cwd?: string;
  smart?: boolean;
  windowMinutes?: number;
  bufferMinutes?: number;
  timeoutSeconds?: number;
}): Promise<InstalledSchedule> {
  const times = normalizeTimes(input.times);
  const schedule = getSchedulePaths(input.agent);
  if (!schedule.servicePath || !schedule.timerPath || !schedule.metadataPath) {
    throw new Error("Linux systemd schedule paths are missing.");
  }
  const cwd = input.cwd || process.cwd();
  const programArguments = buildProgramArguments({
    command: input.command,
    agent: input.agent,
    budgetUsd: input.budgetUsd,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  });

  const systemdAvailable = await hasLinuxSystemd();
  if (systemdAvailable) {
    await mkdir(path.dirname(schedule.servicePath), { recursive: true });
    await mkdir(path.dirname(schedule.logPath), { recursive: true });

    await atomicWriteFile(schedule.servicePath, buildSystemdServiceUnit({
      description: `${buildLinuxScheduleLabel(input.agent)} wake`,
      cwd,
      logPath: schedule.logPath,
      errorLogPath: schedule.errorLogPath,
      environment: buildLinuxEnvironment(),
      programArguments
    }));
    await atomicWriteFile(schedule.timerPath, buildSystemdTimerUnit({
      description: `${buildLinuxScheduleLabel(input.agent)} wake timer`,
      serviceName: path.basename(schedule.servicePath),
      times
    }));
    await atomicWriteFile(schedule.metadataPath, JSON.stringify({
      agent: input.agent,
      label: buildLinuxScheduleLabel(input.agent),
      schedulerKind: "systemd",
      servicePath: schedule.servicePath,
      timerPath: schedule.timerPath,
      logPath: schedule.logPath,
      errorLogPath: schedule.errorLogPath,
      times,
      budgetUsd: input.budgetUsd,
      command: input.command,
      smart: input.smart ?? true,
      windowMinutes: input.windowMinutes,
      bufferMinutes: input.bufferMinutes,
      timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
    }, null, 2));

    await systemctlUser(["daemon-reload"]);
    await systemctlUser(["enable", "--now", path.basename(schedule.timerPath)]);

    return {
      agent: input.agent,
      label: buildLinuxScheduleLabel(input.agent),
      plistPath: "",
      schedulerKind: "systemd",
      metadataPath: schedule.metadataPath,
      servicePath: schedule.servicePath,
      timerPath: schedule.timerPath,
      logPath: schedule.logPath,
      errorLogPath: schedule.errorLogPath,
      times,
      budgetUsd: input.budgetUsd,
      command: input.command,
      smart: input.smart ?? true,
      windowMinutes: input.windowMinutes,
      bufferMinutes: input.bufferMinutes,
      timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
    };
  }

  await mkdir(path.dirname(schedule.scriptPath || path.join(getQwakeHome(), "schedules", `qwake-${input.agent}.sh`)), { recursive: true });
  await mkdir(path.dirname(schedule.logPath), { recursive: true });
  const cronScriptPath = path.join(path.dirname(schedule.metadataPath), `qwake-${input.agent}.sh`);
  await atomicWriteFile(cronScriptPath, renderLinuxCronScript({
    cwd,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    environment: buildLinuxEnvironment(),
    programArguments
  }));
  await installCronEntries(input.agent, times, cronScriptPath);
  await atomicWriteFile(schedule.metadataPath, JSON.stringify({
    agent: input.agent,
    label: buildLinuxScheduleLabel(input.agent),
    schedulerKind: "cron",
    scriptPath: cronScriptPath,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    times,
    budgetUsd: input.budgetUsd,
    command: input.command,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  }, null, 2));
  return {
    agent: input.agent,
    label: buildLinuxScheduleLabel(input.agent),
    plistPath: "",
    schedulerKind: "cron",
    metadataPath: schedule.metadataPath,
    scriptPath: cronScriptPath,
    logPath: schedule.logPath,
    errorLogPath: schedule.errorLogPath,
    times,
    budgetUsd: input.budgetUsd,
    command: input.command,
    smart: input.smart ?? true,
    windowMinutes: input.windowMinutes,
    bufferMinutes: input.bufferMinutes,
    timeoutSeconds: input.timeoutSeconds ?? DEFAULT_WAKE_TIMEOUT_SECONDS
  };
}

async function uninstallLinuxSchedule(agent: AgentName): Promise<InstalledSchedule | undefined> {
  const schedules = await linuxScheduleStatus(agent);
  if (schedules.length === 0) {
    return undefined;
  }
  const schedule = schedules[0];
  if (schedule.schedulerKind === "cron") {
    await uninstallCronEntries(agent);
  } else if (schedule.timerPath) {
    await systemctlUser(["disable", "--now", path.basename(schedule.timerPath)], true);
    await rm(schedule.timerPath, { force: true });
  }
  if (schedule.servicePath) {
    await rm(schedule.servicePath, { force: true });
  }
  if (schedule.metadataPath) {
    await rm(schedule.metadataPath, { force: true });
  }
  await systemctlUser(["daemon-reload"], true);
  return schedule;
}

async function linuxScheduleStatus(agent?: AgentName): Promise<InstalledSchedule[]> {
  const agents: AgentName[] = agent ? [agent] : ["codex", "claude", "mock", "custom"];
  const schedules: InstalledSchedule[] = [];
  for (const item of agents) {
    const schedule = await readLinuxScheduleMetadata(item);
    if (schedule) {
      schedules.push(schedule);
    }
  }
  return schedules;
}

async function readLinuxScheduleMetadata(agent: AgentName): Promise<InstalledSchedule | undefined> {
  const schedule = getSchedulePaths(agent);
  if (!schedule.metadataPath || !existsSync(schedule.metadataPath)) {
    return undefined;
  }
  try {
    const raw = await readFile(schedule.metadataPath, "utf8");
    const parsed = JSON.parse(raw) as {
      label?: string;
      schedulerKind?: "systemd" | "cron";
      scriptPath?: string;
      servicePath?: string;
      timerPath?: string;
      logPath?: string;
      errorLogPath?: string;
      times?: string[];
      budgetUsd?: string;
      command?: string;
      smart?: boolean;
      windowMinutes?: number;
      bufferMinutes?: number;
      timeoutSeconds?: number;
    };
    if (!parsed.times?.length) {
      return undefined;
    }
    return {
      agent,
      label: parsed.label || buildLinuxScheduleLabel(agent),
      plistPath: "",
      schedulerKind: parsed.schedulerKind || "systemd",
      metadataPath: schedule.metadataPath,
      scriptPath: parsed.scriptPath || schedule.scriptPath,
      servicePath: parsed.servicePath || schedule.servicePath,
      timerPath: parsed.timerPath || schedule.timerPath,
      logPath: parsed.logPath || schedule.logPath,
      errorLogPath: parsed.errorLogPath || schedule.errorLogPath,
      times: normalizeTimes(parsed.times),
      budgetUsd: parsed.budgetUsd,
      command: parsed.command,
      smart: parsed.smart,
      windowMinutes: parsed.windowMinutes,
      bufferMinutes: parsed.bufferMinutes,
      timeoutSeconds: parsed.timeoutSeconds
    };
  } catch {
    return undefined;
  }
}

function buildLinuxEnvironment(): Record<string, string> {
  return {
    QWAKE_HOME: getQwakeHome(),
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin"
  };
}

export function buildLinuxScheduleLabel(agent: AgentName): string {
  return `qwake-${agent}`;
}

export function renderLinuxCronScript(input: {
  cwd: string;
  logPath: string;
  errorLogPath: string;
  environment: Record<string, string>;
  programArguments: string[];
}): string {
  const env = Object.entries(input.environment)
    .map(([key, value]) => `${key}="${escapeShellValue(value)}"`)
    .join(" ");
  return `#!/bin/sh
cd "${escapeShellValue(input.cwd)}" || exit 1
${env} ${quoteShellCommand(input.programArguments)} >> "${escapeShellValue(input.logPath)}" 2>> "${escapeShellValue(input.errorLogPath)}"
`;
}

export function buildCronLine(input: {
  time: string;
  scriptPath: string;
  label: string;
}): string {
  const parsed = parseWindow(input.time);
  if (!parsed) {
    throw new Error(`Invalid time "${input.time}".`);
  }
  return `${parsed.minute} ${parsed.hour} * * * /bin/sh "${input.scriptPath}" # ${input.label}`;
}

export function buildSystemdServiceUnit(input: {
  description: string;
  cwd: string;
  logPath: string;
  errorLogPath: string;
  environment: Record<string, string>;
  programArguments: string[];
}): string {
  return `[Unit]
Description=${escapeSystemdValue(input.description)}

[Service]
Type=oneshot
WorkingDirectory=${escapeSystemdValue(input.cwd)}
${Object.entries(input.environment).map(([key, value]) => `Environment="${escapeSystemdEnvironment(key)}=${escapeSystemdEnvironment(value)}"`).join("\n")}
ExecStart=${quoteSystemdCommand(input.programArguments)}
StandardOutput=append:${escapeSystemdValue(input.logPath)}
StandardError=append:${escapeSystemdValue(input.errorLogPath)}
`;
}

export function buildSystemdTimerUnit(input: {
  description: string;
  serviceName: string;
  times: string[];
}): string {
  return `[Unit]
Description=${escapeSystemdValue(input.description)}

[Timer]
${normalizeTimes(input.times).map((time) => `OnCalendar=*-*-* ${time}:00`).join("\n")}
Persistent=true
Unit=${escapeSystemdValue(input.serviceName)}

[Install]
WantedBy=timers.target
`;
}

function quoteSystemdCommand(args: string[]): string {
  return args.map((arg) => `"${arg.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`).join(" ");
}

function quoteShellCommand(args: string[]): string {
  return args.map((arg) => `"${escapeShellValue(arg)}"`).join(" ");
}

function escapeSystemdValue(value: string): string {
  return value.replaceAll("\n", " ");
}

function escapeSystemdEnvironment(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function escapeShellValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function renderLaunchAgentPlist(input: {
  label: string;
  cwd: string;
  programArguments: string[];
  times: string[];
  logPath: string;
  errorLogPath: string;
  environment: Record<string, string>;
}): string {
  const intervals = input.times.map((time) => {
    const parsed = parseWindow(time);
    if (!parsed) {
      throw new Error(`Invalid time "${time}".`);
    }
    return `    <dict>
      <key>Hour</key>
      <integer>${parsed.hour}</integer>
      <key>Minute</key>
      <integer>${parsed.minute}</integer>
    </dict>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(input.label)}</string>
  <key>WorkingDirectory</key>
  <string>${escapeXml(input.cwd)}</string>
  <key>ProgramArguments</key>
  <array>
${input.programArguments.map((arg) => `    <string>${escapeXml(arg)}</string>`).join("\n")}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(input.environment).map(([key, value]) => `    <key>${escapeXml(key)}</key>
    <string>${escapeXml(value)}</string>`).join("\n")}
  </dict>
  <key>StartCalendarInterval</key>
  <array>
${intervals}
  </array>
  <key>StandardOutPath</key>
  <string>${escapeXml(input.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(input.errorLogPath)}</string>
</dict>
</plist>
`;
}

async function readScheduleTimes(plistPath: string): Promise<string[]> {
  const content = await readFile(plistPath, "utf8");
  const matches = [...content.matchAll(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>\s*<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/g)];
  return matches.map((match) => `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`);
}

async function loadLaunchAgent(plistPath: string): Promise<void> {
  await launchctl(["load", plistPath]);
}

async function unloadLaunchAgent(plistPath: string): Promise<void> {
  await launchctl(["unload", plistPath], true);
}

function launchctl(args: string[], ignoreFailure = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("launchctl", args, { stdio: "ignore" });
    child.on("error", (error) => {
      if (ignoreFailure) {
        resolve();
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0 || ignoreFailure) {
        resolve();
      } else {
        reject(new Error(`launchctl ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

function schtasks(args: string[], ignoreFailure = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("schtasks.exe", args, { stdio: "ignore" });
    child.on("error", (error) => {
      if (ignoreFailure) {
        resolve();
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0 || ignoreFailure) {
        resolve();
      } else {
        reject(new Error(`schtasks ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

function crontab(args: string[], ignoreFailure = false, stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("crontab", args, { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", (error) => {
      if (ignoreFailure) {
        resolve(stdout);
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0 || ignoreFailure) {
        resolve(stdout);
      } else {
        reject(new Error(`crontab ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function shellScript(command: [string, ...string[]], ignoreFailure = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { stdio: "ignore" });
    child.on("error", (error) => {
      if (ignoreFailure) {
        resolve();
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0 || ignoreFailure) {
        resolve();
      } else {
        reject(new Error(`${command.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

function commandAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, process.platform === "win32" ? ["/?"] : ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", () => resolve(true));
  });
}

async function schedulesExist(schedules: InstalledSchedule[]): Promise<boolean> {
  const checks = await runScheduleExistenceChecks(schedules);
  return checks.every((check) => check.available);
}

async function runScheduleExistenceChecks(schedules: InstalledSchedule[]): Promise<SchedulerDoctorCheck[]> {
  const checks = schedules.flatMap((schedule) => buildScheduleExistenceChecks({
    platform: process.platform,
    schedule
  }));
  return Promise.all(checks.map(async (check) => {
    const result = await commandSucceeds(check.command, check.args);
    const available = result.exitCode === 0 && (
      check.outputIncludes === undefined || result.output.includes(check.outputIncludes)
    );
    return {
      name: check.name,
      available,
      detail: available ? check.availableLabel : check.missingLabel
    };
  }));
}

function commandSucceeds(command: string, args: string[]): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", () => resolve({ exitCode: null, output }));
    child.on("close", (code) => resolve({ exitCode: code, output }));
  });
}

function systemctlUser(args: string[], ignoreFailure = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("systemctl", ["--user", ...args], { stdio: "ignore" });
    child.on("error", (error) => {
      if (ignoreFailure) {
        resolve();
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0 || ignoreFailure) {
        resolve();
      } else {
        reject(new Error(`systemctl --user ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

async function ensureLinuxSystemdAvailable(): Promise<void> {
  if (process.platform !== "linux") {
    return;
  }
  await systemctlUser(["--version"]);
}

async function hasLinuxSystemd(): Promise<boolean> {
  if (process.platform !== "linux") {
    return false;
  }
  try {
    await ensureLinuxSystemdAvailable();
    return true;
  } catch {
    return false;
  }
}

async function installCronEntries(agent: AgentName, times: string[], scriptPath: string): Promise<void> {
  const existing = await readCrontab();
  const filtered = existing.filter((line) => !line.includes(`# QWAKE:${agent}`));
  const additions = normalizeTimes(times).map((time) => buildCronLine({
    time,
    scriptPath,
    label: `QWAKE:${agent}`
  }));
  await writeCrontab([...filtered, ...additions]);
}

async function uninstallCronEntries(agent: AgentName): Promise<void> {
  const existing = await readCrontab();
  const filtered = existing.filter((line) => !line.includes(`# QWAKE:${agent}`));
  await writeCrontab(filtered);
}

async function readCrontab(): Promise<string[]> {
  const output = await crontab(["-l"], true);
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

async function writeCrontab(lines: string[]): Promise<void> {
  await crontab(["-"], false, `${lines.join("\n")}${lines.length ? "\n" : ""}`);
}

function assertMacOS(): void {
  if (process.platform !== "darwin") {
    throw new Error("schedule install is currently implemented for macOS LaunchAgent only.");
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
