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

export const emptyLine = () => ({
  productId: '',
  productLabel: '',
  productListPrice: undefined,
  productTaxRate: undefined,
  productIsSubscribable: false,
  quantity: 1,
  discountPercent: 0,
  isRecurring: false,
  recurringCycle: '',
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
  quantity: line.quantity,
  discountPercent: line.discountPercent,
  isRecurring: line.isRecurring,
  recurringCycle: line.recurringCycle ?? '',
});
