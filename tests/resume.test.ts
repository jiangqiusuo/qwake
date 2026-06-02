import { describe, expect, it } from "vitest";
import { renderResumeMarkdown } from "../src/resume.js";
import type { Task } from "../src/types.js";

describe("renderResumeMarkdown", () => {
  it("renders stable resume sections", () => {
    const task: Task = {
      id: "task_123",
      goal: "Fix tests",
      agent: "mock",
      projectPath: "/tmp/project",
      status: "queued",
      createdAt: "2026-05-30T00:00:00.000Z",
      updatedAt: "2026-05-30T00:00:00.000Z",
      retryAt: "2026-05-30T06:30:00.000Z",
      resumePath: "/tmp/task/resume.md",
      recentOutput: "usage limit",
      currentState: "Stopped at limit",
      nextStep: "Run tests again",
      attempts: 0
    };

    const markdown = renderResumeMarkdown(task);
    expect(markdown).toContain("# Resume Context");
    expect(markdown).toContain("## Goal");
    expect(markdown).toContain("Fix tests");
    expect(markdown).toContain("## Recent Output");
  });
});
