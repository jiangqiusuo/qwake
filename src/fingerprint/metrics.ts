export interface CellDistribution {
  cellId: string;
  samples: number;
  invalid: number;
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  entropy: number;
}

export interface FingerprintProfile {
  schemaVersion: 1;
  name: string;
  createdAt: string;
  sourceRunId?: string;
  model?: string;
  provider?: string;
  cells: Record<string, CellDistribution>;
}

export interface FingerprintComparison {
  sharedCells: number;
  distance: number;
  verdict: "likely_match" | "suspicious_drift" | "likely_mismatch" | "inconclusive";
  cellDistances: Array<{ cellId: string; distance: number }>;
}

export function buildDistribution(cellId: string, values: Array<{ value: string; valid: boolean }>): CellDistribution {
  const counts: Record<string, number> = {};
  let invalid = 0;
  for (const item of values) {
    if (!item.valid) {
      invalid += 1;
      continue;
    }
    counts[item.value] = (counts[item.value] || 0) + 1;
  }
  const validSamples = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const probabilities: Record<string, number> = {};
  for (const [answer, count] of Object.entries(counts)) {
    probabilities[answer] = validSamples === 0 ? 0 : count / validSamples;
  }
  return {
    cellId,
    samples: values.length,
    invalid,
    counts,
    probabilities,
    entropy: entropy(probabilities)
  };
}

export function compareProfiles(left: FingerprintProfile, right: FingerprintProfile): FingerprintComparison {
  const cellDistances: Array<{ cellId: string; distance: number }> = [];
  for (const cellId of Object.keys(left.cells).sort()) {
    const leftCell = left.cells[cellId];
    const rightCell = right.cells[cellId];
    if (!rightCell) {
      continue;
    }
    if (validSampleCount(leftCell) < 3 || validSampleCount(rightCell) < 3) {
      continue;
    }
    cellDistances.push({
      cellId,
      distance: jensenShannonDivergence(leftCell.probabilities, rightCell.probabilities)
    });
  }

  if (cellDistances.length === 0) {
    return { sharedCells: 0, distance: Number.NaN, verdict: "inconclusive", cellDistances: [] };
  }
  const distance = cellDistances.reduce((sum, item) => sum + item.distance, 0) / cellDistances.length;
  return {
    sharedCells: cellDistances.length,
    distance,
    verdict: verdictForDistance(distance, cellDistances.length),
    cellDistances
  };
}

export function jensenShannonDivergence(
  left: Record<string, number>,
  right: Record<string, number>
): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const midpoint: Record<string, number> = {};
  for (const key of keys) {
    midpoint[key] = ((left[key] || 0) + (right[key] || 0)) / 2;
  }
  return (klDivergence(left, midpoint, keys) + klDivergence(right, midpoint, keys)) / 2;
}

function klDivergence(
  left: Record<string, number>,
  right: Record<string, number>,
  keys: Set<string>
): number {
  let sum = 0;
  for (const key of keys) {
    const p = left[key] || 0;
    const q = right[key] || 0;
    if (p > 0 && q > 0) {
      sum += p * Math.log2(p / q);
    }
  }
  return sum;
}

function entropy(probabilities: Record<string, number>): number {
  return -Object.values(probabilities)
    .filter((probability) => probability > 0)
    .reduce((sum, probability) => sum + probability * Math.log2(probability), 0);
}

function validSampleCount(cell: CellDistribution): number {
  return Object.values(cell.counts).reduce((sum, count) => sum + count, 0);
}

function verdictForDistance(distance: number, sharedCells: number): FingerprintComparison["verdict"] {
  if (sharedCells < 4) {
    return "inconclusive";
  }
  if (distance <= 0.18) {
    return "likely_match";
  }
  if (distance <= 0.32) {
    return "suspicious_drift";
  }
  return "likely_mismatch";
}
