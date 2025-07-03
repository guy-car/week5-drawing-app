/**
 * Simple performance measurement utility that logs timestamps with labels
 */
export function stamp(label: string) {
  if (__DEV__) {
    console.log(`[PERF] ${label}: ${Date.now()}`);
  }
} 