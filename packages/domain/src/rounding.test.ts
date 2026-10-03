import { describe, expect, it } from 'vitest';
import { roundTo, roundToTotal } from './index';

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

describe('roundToTotal', () => {
  it('makes displayed cells add up to the displayed total', () => {
    // Naive rounding gives 0.33 × 3 = 0.99, but the total rounds to 1.00
    const cells = roundToTotal([1 / 3, 1 / 3, 1 / 3], 2);
    expect(cells).toEqual([0.34, 0.33, 0.33]);
    expect(sum(cells)).toBeCloseTo(1, 10);
  });

  it('gives the extra unit to the largest remainder', () => {
    expect(roundToTotal([0.114, 0.118, 0.118], 2)).toEqual([0.11, 0.12, 0.12]);
    expect(roundToTotal([0.125, 0.125, 0.125, 0.125], 1)).toEqual([0.2, 0.1, 0.1, 0.1]);
  });

  it('is not thrown by binary float noise', () => {
    expect(roundToTotal([1.005], 2)).toEqual([1.01]);
  });

  it('keeps already-exact values unchanged', () => {
    expect(roundToTotal([0.8, 1, 1.15, 0.9], 2)).toEqual([0.8, 1, 1.15, 0.9]);
  });

  it.each([2, 1])('holds for 12 random months at %i decimals', (decimals) => {
    const values = Array.from({ length: 12 }, (_, i) => ((i * 7919) % 1000) / 997);
    const cells = roundToTotal(values, decimals);
    expect(sum(cells)).toBeCloseTo(roundTo(sum(values), decimals), 10);
  });
});
