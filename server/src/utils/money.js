// Prisma returns Decimal columns as Decimal.js objects, which JSON.stringify
// renders as strings. The API exposes plain numbers instead, so the frontend can
// do arithmetic without pulling in a decimal library.
//
// Decimal stays the storage and calculation type; this conversion happens only at
// the very edge, when a record is about to become JSON.
export const toNumber = (decimal) =>
  decimal === null || decimal === undefined ? null : Number(decimal);

// Rounds to 2 decimal places without the floating point surprises of toFixed on
// halfway values. Used for derived figures that were never stored as Decimal.
export const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Margin as a percentage of the selling price. The figure the rep watches while
// discounting, so it is computed one way, here, and never in the frontend.
export const marginPercent = (sellPrice, costPrice) => {
  if (!sellPrice) return 0;
  return round2(((sellPrice - costPrice) / sellPrice) * 100);
};
