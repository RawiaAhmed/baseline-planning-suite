import { sortBy, sum } from 'es-toolkit';

/** Absorbs binary float noise such as 1.005 * 100 = 100.49999999999999. Not a rounding budget. */
const EPSILON = 1e-9;

/**
 * Rounds `values` to `decimals` so the rounded values add up exactly to the
 * rounded total (largest-remainder method).
 *
 * Written here because no maintained library fits: the only npm package
 * (largest-remainder-round) has no types and rounds to whole numbers only.
 */
export function roundToTotal(values: readonly number[], decimals: number): number[] {
  const scale = 10 ** decimals;

  // 1. Round every value down, in whole display units (e.g. cents).
  const cells = values.map((value, index) => {
    const scaled = value * scale;
    const units = Math.floor(scaled + EPSILON);
    return { index, units, remainder: scaled - units };
  });

  // 2. Count how many units are still missing from the rounded total.
  const roundedTotal = Math.round(sum(values) * scale + EPSILON);
  const missing = roundedTotal - sum(cells.map((cell) => cell.units));

  // 3. Give one unit each to the cells that lost the most in step 1.
  const byLargestRemainder = sortBy(cells, [(cell) => -cell.remainder, 'index']);
  for (const cell of byLargestRemainder.slice(0, missing)) {
    cell.units += 1;
  }

  return cells.map((cell) => cell.units / scale);
}

/** Rounds one exact value for display. */
export function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale + EPSILON) / scale;
}
