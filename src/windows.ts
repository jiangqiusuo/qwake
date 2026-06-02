export function nextRetryTime(retryWindows: string[], from = new Date()): Date {
  const parsed = retryWindows
    .map(parseWindow)
    .filter((value): value is { hour: number; minute: number } => Boolean(value))
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);

  if (parsed.length === 0) {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }

  for (const window of parsed) {
    const candidate = new Date(from);
    candidate.setHours(window.hour, window.minute, 0, 0);
    if (candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }

  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(parsed[0].hour, parsed[0].minute, 0, 0);
  return tomorrow;
}

export function parseWindow(value: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }
  return { hour, minute };
}
