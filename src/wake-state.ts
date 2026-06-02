import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson } from "./fs-utils.js";
import { getWakesDir } from "./paths.js";
import type { AgentName } from "./types.js";

export interface WakeState {
  agent: AgentName;
  lastSuccessAt: string;
  updatedAt: string;
}

export interface SmartWakeDecision {
  shouldRun: boolean;
  lastSuccessAt?: string;
  nextWakeAt?: string;
}

export async function getSmartWakeDecision(input: {
  agent: AgentName;
  now?: Date;
  windowMinutes: number;
  bufferMinutes: number;
}): Promise<SmartWakeDecision> {
  const state = await readWakeState(input.agent);
  if (!state) {
    return { shouldRun: true };
  }

  const lastSuccess = new Date(state.lastSuccessAt);
  if (Number.isNaN(lastSuccess.getTime())) {
    return { shouldRun: true };
  }

  const thresholdMs = (input.windowMinutes + input.bufferMinutes) * 60_000;
  const nextWake = new Date(lastSuccess.getTime() + thresholdMs);
  const now = input.now || new Date();
  return {
    shouldRun: now.getTime() >= nextWake.getTime(),
    lastSuccessAt: state.lastSuccessAt,
    nextWakeAt: nextWake.toISOString()
  };
}

export async function recordWakeSuccess(agent: AgentName, now = new Date()): Promise<WakeState> {
  const state = {
    agent,
    lastSuccessAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  await atomicWriteJson(getWakeStatePath(agent), state);
  return state;
}

export async function readWakeState(agent: AgentName): Promise<WakeState | undefined> {
  const statePath = getWakeStatePath(agent);
  if (!existsSync(statePath)) {
    return undefined;
  }
  return JSON.parse(await readFile(statePath, "utf8")) as WakeState;
}

function getWakeStatePath(agent: AgentName): string {
  return path.join(getWakesDir(), `${agent}.json`);
}
