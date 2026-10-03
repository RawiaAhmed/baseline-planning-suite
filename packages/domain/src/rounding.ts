/** Absorbs binary float noise such as 1.005 * 100 = 100.49999999999999. Not a rounding budget. */
const EPSILON = 1e-9;

/**
 * Rounds `values` to `decimals` so that the rounded values add up exactly to
 * the rounded exact total (largest-remainder method).
 *
 * Each value is first rounded down; the units still missing from the total
 * go one each to the values with the largest remainders.
 */
export function roundToTotal(values: readonly number[], decimals: number): number[] {
  const scale = 10 ** decimals;
  const scaled = values.map((v) => v * scale);
  const floors = scaled.map((v) => Math.floor(v + EPSILON));
  const target = Math.round(scaled.reduce((sum, v) => sum + v, 0) + EPSILON);
  let missing = target - floors.reduce((sum, v) => sum + v, 0);

  const byRemainder = scaled
    .map((v, index) => ({ index, remainder: v - (floors[index] ?? 0) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const units = [...floors];
  for (const { index } of byRemainder) {
    if (missing <= 0) break;
    units[index] = (units[index] ?? 0) + 1;
    missing -= 1;
  }
  return units.map((u) => u / scale);
}

/** Rounds one exact value for display. */
export function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale + EPSILON) / scale;
}
