import { describe, expect, it } from "vitest";
import { normalizeTimes } from "../src/scheduler.js";

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
});
