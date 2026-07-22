import { normalizeAnswer } from "./normalize.js";
import { getProbeCells, type FingerprintPreset, type ProbeLanguage, type ProbeCell } from "./probes.js";
import { buildDistribution, type FingerprintProfile } from "./metrics.js";
import { requestChatCompletion } from "./client.js";

export interface FingerprintSample {
  cellId: string;
  task: string;
  language: string;
  repetition: number;
  prompt: string;
  raw: string;
  normalized: string;
  valid: boolean;
  reason?: string;
  latencyMs?: number;
  rawModel?: string;
  usage?: unknown;
  error?: string;
  timestamp: string;
}

export interface FingerprintRun {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  provider: "openai-compatible";
  baseUrl: string;
  model: string;
  preset: FingerprintPreset;
  samplesPerCell: number;
  cells: ProbeCell[];
  samples: FingerprintSample[];
}

export interface CollectFingerprintOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  preset?: FingerprintPreset;
  languages?: ProbeLanguage[];
  samplesPerCell?: number;
  timeoutSeconds?: number;
  temperature?: number;
  maxTokens?: number;
  concurrency?: number;
  quiet?: boolean;
}

export async function collectFingerprint(options: CollectFingerprintOptions): Promise<FingerprintRun> {
  const preset = options.preset ?? "mini";
  const samplesPerCell = options.samplesPerCell ?? 15;
  const cells = getProbeCells(preset, options.languages ?? ["en"]);
  if (cells.length === 0) {
    throw new Error("No fingerprint probe cells selected.");
  }
  const run: FingerprintRun = {
    schemaVersion: 1,
    id: `fp_${new Date().toISOString().replace(/[:.]/g, "-")}`,
    createdAt: new Date().toISOString(),
    provider: "openai-compatible",
    baseUrl: redactUrl(options.baseUrl),
    model: options.model,
    preset,
    samplesPerCell,
    cells,
    samples: []
  };

  const jobs = seededJobs(cells, samplesPerCell);
  const concurrency = Math.max(1, options.concurrency ?? 1);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      if (!job) {
        continue;
      }
      const sample = await collectOne(options, job.cell, job.repetition);
      run.samples.push(sample);
      if (!options.quiet) {
        const mark = sample.error ? "failed" : sample.valid ? sample.normalized : "invalid";
        process.stderr.write(`fingerprint ${sample.cellId} #${sample.repetition}: ${mark}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  run.samples.sort((left, right) => {
    const cell = left.cellId.localeCompare(right.cellId);
    return cell === 0 ? left.repetition - right.repetition : cell;
  });
  return run;
}

export function profileFromRun(run: FingerprintRun, name: string): FingerprintProfile {
  const cells: FingerprintProfile["cells"] = {};
  for (const cell of run.cells) {
    const samples = run.samples
      .filter((sample) => sample.cellId === cell.id && !sample.error)
      .map((sample) => ({ value: sample.normalized, valid: sample.valid }));
    cells[cell.id] = buildDistribution(cell.id, samples);
  }
  return {
    schemaVersion: 1,
    name,
    createdAt: new Date().toISOString(),
    sourceRunId: run.id,
    model: run.model,
    provider: run.provider,
    cells
  };
}

async function collectOne(
  options: CollectFingerprintOptions,
  cell: ProbeCell,
  repetition: number
): Promise<FingerprintSample> {
  try {
    const result = await requestChatCompletion({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      timeoutSeconds: options.timeoutSeconds,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    }, cell.prompt);
    const normalized = normalizeAnswer(result.text, cell.task);
    return {
      cellId: cell.id,
      task: cell.task,
      language: cell.language,
      repetition,
      prompt: cell.prompt,
      raw: result.text,
      normalized: normalized.value,
      valid: normalized.valid,
      reason: normalized.reason,
      latencyMs: result.latencyMs,
      rawModel: result.rawModel,
      usage: result.usage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      cellId: cell.id,
      task: cell.task,
      language: cell.language,
      repetition,
      prompt: cell.prompt,
      raw: "",
      normalized: "",
      valid: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

function seededJobs(cells: ProbeCell[], samplesPerCell: number): Array<{ cell: ProbeCell; repetition: number }> {
  const jobs: Array<{ cell: ProbeCell; repetition: number }> = [];
  for (let repetition = 1; repetition <= samplesPerCell; repetition += 1) {
    for (const cell of cells) {
      jobs.push({ cell, repetition });
    }
  }
  return jobs;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}
