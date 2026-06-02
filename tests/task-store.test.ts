import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TaskStore } from "../src/task-store.js";

describe("TaskStore", () => {
  it("creates, reads, and updates tasks", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-test-"));
    const store = new TaskStore(home);
    const task = await store.create({
      goal: "Ship MVP",
      agent: "mock",
      projectPath: "/tmp/project",
      retryAt: new Date("2026-05-30T06:30:00.000Z")
    });

    expect(task.id).toMatch(/^task_/);
    expect(await store.get(task.id)).toMatchObject({ goal: "Ship MVP" });
    expect(await readFile(task.resumePath, "utf8")).toContain("Ship MVP");

    const updated = await store.setStatus(task, "completed");
    expect(updated.status).toBe("completed");
    expect((await store.list())[0]?.status).toBe("completed");
  });

  it("returns due queued tasks", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "qwake-test-"));
    const store = new TaskStore(home);
    await store.create({
      goal: "Due",
      agent: "mock",
      projectPath: "/tmp/project",
      retryAt: new Date("2026-05-30T06:30:00.000Z")
    });
    await store.create({
      goal: "Later",
      agent: "mock",
      projectPath: "/tmp/project",
      retryAt: new Date("2026-05-30T08:30:00.000Z")
    });

    const due = await store.due(new Date("2026-05-30T07:00:00.000Z"));
    expect(due.map((task) => task.goal)).toEqual(["Due"]);
  });
});
