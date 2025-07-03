/**
 * Simple performance measurement utility that logs timestamps with labels
 */

// Store absolute timestamps for each label so we can compute deltas later
const _marks: Record<string, number> = {};

export function stamp(label: string) {
  const t = Date.now();
  _marks[label] = t;
  if (__DEV__) {
    // Log immediately for inline debugging
    //console.log(`[PERF] ${label}: ${t}`);
  }
}

/**
 * Pretty-prints a step-by-step latency table to the console.
 * Call this at the end of an operation (e.g. when the AI stream finishes).
 */
export function printPerf() {
  const labels = Object.keys(_marks);
  if (labels.length === 0) return;

  const first = _marks[labels[0]];
  const rows = labels.map((label, idx) => {
    const now = _marks[label];
    const prev = idx === 0 ? now : _marks[labels[idx - 1]];
    return {
      step: label,
      ms: now - prev,
      total: now - first,
    };
  });

  // eslint-disable-next-line no-console
  console.table(rows);
} 