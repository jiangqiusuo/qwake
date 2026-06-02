import { describe, expect, it } from "vitest";
import { nextRetryTime, parseWindow } from "../src/windows.js";

describe("retry windows", () => {
  it("parses valid windows", () => {
    expect(parseWindow("06:30")).toEqual({ hour: 6, minute: 30 });
  });

  it("returns the next same-day retry window", () => {
    const next = nextRetryTime(["06:30", "11:30"], new Date(2026, 4, 30, 8, 0, 0, 0));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(4);
    expect(next.getDate()).toBe(30);
    expect(next.getHours()).toBe(11);
    expect(next.getMinutes()).toBe(30);
  });

  it("rolls to tomorrow after all windows pass", () => {
    const next = nextRetryTime(["06:30"], new Date(2026, 4, 30, 8, 0, 0, 0));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(4);
    expect(next.getDate()).toBe(31);
    expect(next.getHours()).toBe(6);
    expect(next.getMinutes()).toBe(30);
  });
});
