import type { FingerprintComparison, FingerprintProfile } from "./metrics.js";

export function renderComparisonReport(
  left: FingerprintProfile,
  right: FingerprintProfile,
  comparison: FingerprintComparison
): string {
  const lines = [
    "# Qwake Fingerprint Report",
    "",
    `Left: ${left.name}`,
    `Right: ${right.name}`,
    `Verdict: ${comparison.verdict}`,
    `Shared cells: ${comparison.sharedCells}`,
    `Mean JSD: ${Number.isNaN(comparison.distance) ? "n/a" : comparison.distance.toFixed(4)}`,
    "",
    "## Cell Distances",
    "",
    "| Cell | JSD |",
    "| --- | ---: |"
  ];
  for (const item of comparison.cellDistances) {
    lines.push(`| ${item.cellId} | ${item.distance.toFixed(4)} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("This is statistical behavioral evidence, not cryptographic proof of model identity.");
  lines.push("Use a trusted reference profile and repeat audits when the provider or model version changes.");
  return lines.join("\n");
}
