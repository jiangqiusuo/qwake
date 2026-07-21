import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getFingerprintDir, getQwakeHome } from "../paths.js";
import type { FingerprintProfile } from "./metrics.js";
import type { FingerprintRun } from "./collector.js";

export function getFingerprintRunsDir(home = getQwakeHome()): string {
  return path.join(getFingerprintDir(home), "runs");
}

export function getFingerprintProfilesDir(home = getQwakeHome()): string {
  return path.join(getFingerprintDir(home), "profiles");
}

export async function saveFingerprintRun(run: FingerprintRun, home = getQwakeHome()): Promise<string> {
  const runsDir = getFingerprintRunsDir(home);
  await mkdir(runsDir, { recursive: true });
  const filePath = path.join(runsDir, `${safeName(run.id)}.json`);
  await writeFile(filePath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readFingerprintRun(filePath: string): Promise<FingerprintRun> {
  return JSON.parse(await readFile(filePath, "utf8")) as FingerprintRun;
}

export async function saveFingerprintProfile(profile: FingerprintProfile, home = getQwakeHome()): Promise<string> {
  const profilesDir = getFingerprintProfilesDir(home);
  await mkdir(profilesDir, { recursive: true });
  const filePath = path.join(profilesDir, `${safeName(profile.name)}.json`);
  await writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readFingerprintProfile(value: string, home = getQwakeHome()): Promise<FingerprintProfile> {
  const filePath = value.includes("/") || value.endsWith(".json")
    ? value
    : path.join(getFingerprintProfilesDir(home), `${safeName(value)}.json`);
  return JSON.parse(await readFile(filePath, "utf8")) as FingerprintProfile;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "fingerprint";
}
