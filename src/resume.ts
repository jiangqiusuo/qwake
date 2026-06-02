import type { Task } from "./types.js";

export function renderResumeMarkdown(task: Task): string {
  return `# Resume Context

## Goal

${task.goal}

## Agent

${task.agent}

## Project Path

${task.projectPath}

## Current State

${task.currentState}

## Next Step

${task.nextStep}

## Recent Output

\`\`\`text
${task.recentOutput.trim() || "No recent output captured."}
\`\`\`

## Created At / Updated At

- Created At: ${task.createdAt}
- Updated At: ${task.updatedAt}
`;
}
