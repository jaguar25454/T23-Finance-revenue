import reference from '@/app/data/capricci-menu-prices.json';

export const capricciPriceSource = reference.source;
const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const priceRows = new Map<string, (typeof reference.rows)[number]>();
// Match the first-row convention of the existing ItemCode/Menu master.
for (const row of reference.rows) if (!priceRows.has(key(row.itemCode))) priceRows.set(key(row.itemCode), row);

export function capricciMenuPrice(itemCode: string) {
  const row = priceRows.get(key(itemCode));
  return {
    value: typeof row?.price === 'number' && Number.isFinite(row.price) && row.price >= 0 ? row.price : null,
    cell: row?.cell ?? null,
  };
}
