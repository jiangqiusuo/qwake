import { describe, expect, it } from "vitest";
import { DEFAULT_LIMIT_PATTERNS } from "../src/config.js";
import { isLimitOutput } from "../src/limit-detector.js";

describe("isLimitOutput", () => {
  it("matches default limit patterns case-insensitively", () => {
    expect(isLimitOutput("Claude Usage Limit reached. Try again later.", DEFAULT_LIMIT_PATTERNS)).toBe(
      true
    );
    expect(isLimitOutput("RATE LIMIT: slow down", DEFAULT_LIMIT_PATTERNS)).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isLimitOutput("Syntax error in app.ts", DEFAULT_LIMIT_PATTERNS)).toBe(false);
  });
});
