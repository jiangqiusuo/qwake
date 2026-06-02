import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getSmartWakeDecision, recordWakeSuccess } from "../src/wake-state.js";

describe("wake state", () => {
  beforeEach(async () => {
    process.env.QWAKE_HOME = await mkdtemp(path.join(tmpdir(), "qwake-state-"));
  });

  it("runs when no previous success exists", async () => {
    const decision = await getSmartWakeDecision({
      agent: "mock",
      now: new Date("2026-06-01T00:00:00.000Z"),
      windowMinutes: 300,
      bufferMinutes: 5
    });
    expect(decision.shouldRun).toBe(true);
  });

  it("skips until the window plus buffer has elapsed", async () => {
    await recordWakeSuccess("mock", new Date("2026-06-01T00:00:00.000Z"));
    const skipped = await getSmartWakeDecision({
      agent: "mock",
      now: new Date("2026-06-01T05:04:59.000Z"),
      windowMinutes: 300,
      bufferMinutes: 5
    });
    expect(skipped).toMatchObject({
      shouldRun: false,
      lastSuccessAt: "2026-06-01T00:00:00.000Z",
      nextWakeAt: "2026-06-01T05:05:00.000Z"
    });

    const due = await getSmartWakeDecision({
      agent: "mock",
      now: new Date("2026-06-01T05:05:00.000Z"),
      windowMinutes: 300,
      bufferMinutes: 5
    });
    expect(due.shouldRun).toBe(true);
  });
});
