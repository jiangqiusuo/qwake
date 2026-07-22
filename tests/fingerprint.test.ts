import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "../src/fingerprint/normalize.js";
import { buildDistribution, compareProfiles, type FingerprintProfile } from "../src/fingerprint/metrics.js";
import { getProbeCells } from "../src/fingerprint/probes.js";

describe("fingerprint", () => {
  it("normalizes short answers", () => {
    expect(normalizeAnswer("  “Blue.” ", "random-color")).toMatchObject({
      value: "blue",
      valid: true
    });
    expect(normalizeAnswer("四十二", "random-number-100")).toMatchObject({
      value: "42",
      valid: true
    });
    expect(normalizeAnswer("正面", "coin-flip")).toMatchObject({
      value: "heads",
      valid: true
    });
  });

  it("builds stable probe presets", () => {
    expect(getProbeCells("mini", ["en"])).toHaveLength(8);
    expect(getProbeCells("full", ["en"])).toHaveLength(10);
    expect(getProbeCells("mini", ["en", "zh"])).toHaveLength(16);
  });

  it("compares profile distributions with Jensen-Shannon divergence", () => {
    const left = profile("left", {
      "random-number-100:en": ["42", "42", "37", "42"],
      "coin-flip:en": ["heads", "heads", "tails", "heads"],
      "random-color:en": ["blue", "blue", "red", "blue"],
      "favorite-number:en": ["7", "7", "7", "3"]
    });
    const right = profile("right", {
      "random-number-100:en": ["42", "42", "37", "42"],
      "coin-flip:en": ["heads", "heads", "tails", "heads"],
      "random-color:en": ["blue", "blue", "red", "blue"],
      "favorite-number:en": ["7", "7", "7", "3"]
    });
    const different = profile("different", {
      "random-number-100:en": ["91", "91", "88", "91"],
      "coin-flip:en": ["tails", "tails", "tails", "heads"],
      "random-color:en": ["green", "green", "yellow", "green"],
      "favorite-number:en": ["13", "13", "13", "8"]
    });

    expect(compareProfiles(left, right).verdict).toBe("likely_match");
    expect(compareProfiles(left, different).verdict).toBe("likely_mismatch");
  });
});

function profile(name: string, values: Record<string, string[]>): FingerprintProfile {
  const cells: FingerprintProfile["cells"] = {};
  for (const [cellId, cellValues] of Object.entries(values)) {
    cells[cellId] = buildDistribution(
      cellId,
      cellValues.map((value) => ({ value, valid: true }))
    );
  }
  return {
    schemaVersion: 1,
    name,
    createdAt: "2026-07-21T00:00:00.000Z",
    cells
  };
}
