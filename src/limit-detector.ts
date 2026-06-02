export function isLimitOutput(output: string, patterns: string[]): boolean {
  const haystack = output.toLowerCase();
  return patterns.some((pattern) => {
    const normalized = pattern.trim().toLowerCase();
    return normalized.length > 0 && haystack.includes(normalized);
  });
}
