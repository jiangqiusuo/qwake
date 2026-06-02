import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import type { AgentConfig, AgentName, RunAgentResult, Task } from "./types.js";
import { isLimitOutput } from "./limit-detector.js";
import { renderResumeMarkdown } from "./resume.js";

export interface RunOptions {
  agent: AgentName;
  config: AgentConfig;
  args?: string[];
  cwd?: string;
  input?: string;
  mockMode?: "success" | "limit" | "fail";
  quiet?: boolean;
}

export async function runAgent(options: RunOptions): Promise<RunAgentResult> {
  if (options.agent === "mock") {
    return runMock(options.mockMode || "success", options.config.limitPatterns);
  }

  if (!options.config.command) {
    throw new Error(`Agent "${options.agent}" does not have a command configured.`);
  }

  const args = [...(options.config.args || []), ...(options.args || [])];
  const output = await spawnAndCapture(options.config.command, args, {
    cwd: options.cwd,
    input: options.input,
    quiet: options.quiet
  });
  return {
    exitCode: output.exitCode,
    output: output.output,
    limited: isLimitOutput(output.output, options.config.limitPatterns)
  };
}

export async function runResumeTask(
  task: Task,
  config: AgentConfig,
  args: string[] = [],
  mockMode?: "success" | "limit" | "fail"
): Promise<RunAgentResult> {
  const prompt = `Continue this AI coding task using the resume context below.\n\n${renderResumeMarkdown(task)}\n`;
  return runAgent({
    agent: task.agent,
    config,
    args,
    cwd: task.projectPath,
    input: prompt,
    mockMode
  });
}

export async function commandExists(command: string): Promise<boolean> {
  if (!command) {
    return false;
  }
  if (command.includes("/") || command.startsWith(".")) {
    try {
      await access(command, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
  const probe = await spawnAndCapture(process.platform === "win32" ? "where" : "which", [command], {
    quiet: true
  });
  return probe.exitCode === 0;
}

async function runMock(mode: "success" | "limit" | "fail", patterns: string[]): Promise<RunAgentResult> {
  if (mode === "limit") {
    const output = "Mock agent hit a usage limit. Please try again later.";
    return { exitCode: 1, output, limited: isLimitOutput(output, patterns) };
  }
  if (mode === "fail") {
    const output = "Mock agent failed with a non-limit error.";
    return { exitCode: 1, output, limited: false };
  }
  const output = "Mock agent completed the task successfully.";
  return { exitCode: 0, output, limited: false };
}

function spawnAndCapture(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; quiet?: boolean } = {}
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      if (!options.quiet) {
        process.stdout.write(text);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      if (!options.quiet) {
        process.stderr.write(text);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, output });
    });

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}
