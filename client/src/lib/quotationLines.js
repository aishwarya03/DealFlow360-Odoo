import { listProducts } from '../api/products';
import { formatINR } from './currency';

export const searchProducts = async (query) => {
  const result = await listProducts({ includeInactive: 'false', limit: 20, ...(query ? { search: query } : {}) });
  return result.products.map((product) => ({
    value: product.id,
    label: `${product.sku} — ${product.name}`,
    hint: formatINR(product.listPrice),
    raw: product,
  }));
};

// Normalizes any allocation shape (a fresh suggestion from
// GET .../allocation-suggestion, or the {warehouseId, warehouse, quantity}
// rows a saved QuotationLine already carries) into one shape the split
// editor renders: warehouseId null means the backorder row.
export const normalizeAllocations = (rows) =>
  (rows ?? []).map((row) => ({
    warehouseId: row.warehouseId ?? null,
    warehouseCode: row.warehouseCode ?? row.warehouse?.code ?? null,
    warehouseName: row.warehouseName ?? row.warehouse?.name ?? 'Backorder',
    quantity: row.quantity,
  }));

// A product is only split across warehouses if it's actually stocked —
// services/combos never get an allocation editor (mirrors the server's
// buildLineData, which skips allocation entirely for non-GOODS products).
export const isStockedProductType = (productType) => productType === 'GOODS';

// Blended discount-governance risk % for a quotation (drives DiscountRiskMeter).
// A plain average of discountPercent across lines lets many small over-ceiling
// violations hide — 2 points over here, 3 there, none alarming alone. So each
// line's discount is weighted by its own value (qty * unitPrice, i.e. how much
// revenue it actually discounts), and any line over its ceiling contributes
// only its excess-over-ceiling (not the raw discount itself) — so a spread of
// small violations stacks into a visibly higher blended number instead of
// averaging away.
export const computeBlendedDiscountRisk = (lines) => {
  if (!lines?.length) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const line of lines) {
    const discount = Number(line.discountPercent) || 0;
    const ceiling = Number(line.ceilingAtEntry) || 0;
    const effectiveDiscount = discount > ceiling ? discount - ceiling : discount;

    const weight = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);

    weightedSum += effectiveDiscount * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
};

export const emptyLine = () => ({
  productId: '',
  productLabel: '',
  productListPrice: undefined,
  productTaxRate: undefined,
  productIsSubscribable: false,
  productType: undefined,
  quantity: 1,
  discountPercent: 0,
  isRecurring: false,
  recurringCycle: '',
  suggestedAs: null,
  suggestedFromProductId: null,
  // undefined = not yet fetched; [] once a suggestion/save has resolved it.
  allocations: undefined,
});

// Seeds an editable row straight from a suggestion returned by
// GET .../product-recommendations/suggest (see QuotationSuggestions) — the
// rep accepted an upsell/cross-sell card, so the resulting line carries that
// attribution. The server independently re-verifies this pairing is a real,
// active recommendation before trusting it (quotation.service.js's
// assertSuggestionProvenance); this is just what pre-fills the row.
export const lineFromSuggestion = (suggestion) => ({
  productId: String(suggestion.product.id),
  productLabel: `${suggestion.product.sku} — ${suggestion.product.name}`,
  productListPrice: suggestion.product.listPrice,
  productTaxRate: suggestion.product.taxRate,
  productIsSubscribable: suggestion.product.isSubscribable,
  productType: suggestion.product.productType,
  quantity: 1,
  discountPercent: 0,
  isRecurring: false,
  recurringCycle: '',
  suggestedAs: suggestion.type,
  suggestedFromProductId: suggestion.triggeredBy.id,
  allocations: undefined,
});

// Seeds an editable row from a real QuotationLine (requote pre-fill, or
// opening the edit-lines modal). Price/GST come from the LINE's own
// unitPrice/taxRateAtEntry snapshot, not a fresh product lookup — the line
// already carries them, and a lookup would fail outright for a product
// that's since been deactivated (the bug this whole component fixes: the
// label must never depend on the product still being in an "active
// products" list).
export const lineFromExisting = (line) => ({
  lineId: line.id,
  productId: String(line.productId),
  productLabel: line.product ? `${line.product.sku} — ${line.product.name}` : `Product #${line.productId}`,
  productListPrice: line.unitPrice,
  productTaxRate: line.taxRateAtEntry,
  productIsSubscribable: line.isRecurring,
  // Not carried on the line itself — inferred from whether it has any
  // allocation rows at all (a SERVICE/COMBO line never gets any, see
  // buildLineData server-side). Good enough to decide whether to render the
  // split editor for an already-saved line; a manually re-picked product
  // gets the real value from selectProduct instead.
  productType: line.allocations && line.allocations.length > 0 ? 'GOODS' : undefined,
  quantity: line.quantity,
  discountPercent: line.discountPercent,
  isRecurring: line.isRecurring,
  recurringCycle: line.recurringCycle ?? '',
  suggestedAs: line.suggestedAs ?? null,
  suggestedFromProductId: line.suggestedFromProductId ?? null,
  allocations: line.allocations ? normalizeAllocations(line.allocations) : undefined,
});
