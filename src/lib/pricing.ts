import type { Size, Tariff } from './domain';

/** Final prices in sum: three sizes × three tariffs. The price does not depend on the chocolate flavour. */
export type PriceTable = Record<Size, Record<Tariff, number>>;

export function priceFor(table: PriceTable, size: Size, tariff: Tariff): number {
  return table[size][tariff];
}
