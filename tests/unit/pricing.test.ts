import { describe, expect, it } from 'vitest';
import { formatSum } from '../../src/lib/format';
import { priceFor, type PriceTable } from '../../src/lib/pricing';

// Nine distinct numbers, so that a swapped cell cannot pass unnoticed.
const table: PriceTable = {
  small: { light: 1_010_000, optima: 1_020_000, maxima: 1_030_000 },
  medium: { light: 2_010_000, optima: 2_020_000, maxima: 2_030_000 },
  large: { light: 3_010_000, optima: 3_020_000, maxima: 3_030_000 },
};

describe('price of a fountain size and tariff', () => {
  it.each([
    ['small', 'light', 1_010_000],
    ['small', 'optima', 1_020_000],
    ['small', 'maxima', 1_030_000],
    ['medium', 'light', 2_010_000],
    ['medium', 'optima', 2_020_000],
    ['medium', 'maxima', 2_030_000],
    ['large', 'light', 3_010_000],
    ['large', 'optima', 3_020_000],
    ['large', 'maxima', 3_030_000],
  ] as const)('%s fountain, %s tariff costs %i', (size, tariff, expected) => {
    expect(priceFor(table, size, tariff)).toBe(expected);
  });
});

describe('sum as written on the site', () => {
  it('Russian: spaces between thousands, then «сум»', () => {
    expect(formatSum(4_100_000, 'ru')).toBe('4 100 000 сум');
  });

  it("Uzbek: spaces between thousands, then «so'm»", () => {
    expect(formatSum(4_100_000, 'uz')).toBe("4 100 000 so'm");
  });

  it('English: commas between thousands, then UZS', () => {
    expect(formatSum(4_100_000, 'en')).toBe('4,100,000 UZS');
  });

  it('a six-digit sum has one separator', () => {
    expect(formatSum(950_000, 'ru')).toBe('950 000 сум');
  });
});
