import { mkdir, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { atomicWriteFile, atomicWriteJson } from "./fs-utils.js";
import { getQwakeHome, getTasksDir } from "./paths.js";
import { renderResumeMarkdown } from "./resume.js";
import type { CreateTaskInput, Task, TaskStatus } from "./types.js";

export class TaskStore {
  private tasksDir: string;

  constructor(private home = getQwakeHome()) {
    this.tasksDir = getTasksDir(home);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const id = `task_${randomUUID().slice(0, 8)}`;
    const taskDir = path.join(this.tasksDir, id);
    const resumePath = path.join(taskDir, "resume.md");
    const task: Task = {
      id,
      goal: input.goal,
      agent: input.agent,
      projectPath: input.projectPath,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      retryAt: input.retryAt.toISOString(),
      resumePath,
      recentOutput: input.recentOutput || "",
      currentState: input.currentState || "The task was queued for a later AI coding window.",
      nextStep: input.nextStep || "Read this resume context and continue the original task.",
      attempts: 0
    };
    await this.save(task);
    return task;
  }

  async list(): Promise<Task[]> {
    if (!existsSync(this.tasksDir)) {
      return [];
    }
    const entries = await readdir(this.tasksDir, { withFileTypes: true });
    const tasks: Task[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const taskPath = path.join(this.tasksDir, entry.name, "task.json");
      if (!existsSync(taskPath)) {
        continue;
      }
      tasks.push(JSON.parse(await readFile(taskPath, "utf8")) as Task);
    }
    return tasks.sort((a, b) => a.retryAt.localeCompare(b.retryAt));
  }

  async get(id: string): Promise<Task | undefined> {
    const taskPath = path.join(this.tasksDir, id, "task.json");
    if (!existsSync(taskPath)) {
      return undefined;
    }
    return JSON.parse(await readFile(taskPath, "utf8")) as Task;
  }

  async nextQueued(): Promise<Task | undefined> {
    return (await this.list()).find((task) => task.status === "queued");
  }

  async due(now = new Date()): Promise<Task[]> {
    const timestamp = now.getTime();
    return (await this.list()).filter(
      (task) => task.status === "queued" && new Date(task.retryAt).getTime() <= timestamp
    );
  }

  async update(task: Task, patch: Partial<Omit<Task, "id" | "createdAt" | "resumePath">>): Promise<Task> {
    const next: Task = {
      ...task,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await this.save(next);
    return next;
  }

  async setStatus(task: Task, status: TaskStatus): Promise<Task> {
    return this.update(task, { status });
  }

  async save(task: Task): Promise<void> {
    const taskDir = path.join(this.tasksDir, task.id);
    await mkdir(taskDir, { recursive: true });
    await atomicWriteJson(path.join(taskDir, "task.json"), task);
    await atomicWriteFile(task.resumePath, renderResumeMarkdown(task));
  }
}
