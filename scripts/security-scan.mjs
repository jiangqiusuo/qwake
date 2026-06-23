import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const skipPaths = [
  /^dist\//,
  /^site\/dist\//,
  /^site\/\.astro\//,
  /^node_modules\//,
  /^site\/node_modules\//,
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/
];

const patterns = [
  { name: "npm token", pattern: /npm_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI-style key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "generic API key assignment", pattern: /(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_.-]{16,}["']/i },
  { name: "personal macOS user path", pattern: /\/Users\/wang[a-zA-Z0-9_-]*/ },
  { name: "personal Windows user path", pattern: /C:\\Users\\wang[a-zA-Z0-9_-]*/i }
];

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !skipPaths.some((skip) => skip.test(file.replaceAll("\\", "/"))));

const findings = [];

for (const file of trackedFiles) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const item of patterns) {
    const match = content.match(item.pattern);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${file}:${line} ${item.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential sensitive information found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log("Security scan passed.");
}
