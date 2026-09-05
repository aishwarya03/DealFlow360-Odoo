import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { listCustomers } from '../api/customers';
import { suggestAllocation } from '../api/inventory';
import { createQuotation } from '../api/quotations';
import { listWarehouses } from '../api/warehouses';
import {
  emptyLine,
  isStockedProductType,
  lineFromExisting,
  lineFromSuggestion,
  normalizeAllocations,
} from '../lib/quotationLines';
import Button from './Button';
import ConfigModal from './ConfigModal';
import QuotationLineRows from './QuotationLineRows';
import QuotationSuggestions from './QuotationSuggestions';
import SearchSelect from './SearchSelect';

const searchCustomers = async (query) => {
  const results = await listCustomers(query ? { search: query } : {});
  return results.map((customer) => ({
    value: customer.id,
    label: customer.name,
    hint: customer.tier?.code ?? String(customer.tierId),
    raw: customer,
  }));
};

// One form, two modes. `source` present -> "Create New Quotation" from an
// existing REJECTED/WITHDRAWN quotation (§1.6): customer is inherited and
// shown read-only, lines are pre-filled from the source so the rep edits
// forward from there rather than starting blank. `source` absent -> a
// standalone quotation, customer picked fresh.
const QuotationFormModal = ({ source, onClose, onCreated }) => {
  const [customerId, setCustomerId] = useState(source ? String(source.customer.id) : '');
  const [customerLabel, setCustomerLabel] = useState(source ? source.customer.name : '');
  const [lines, setLines] = useState(source ? source.lines.map(lineFromExisting) : [emptyLine()]);
  const [isSaving, setIsSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [refreshingIndexes, setRefreshingIndexes] = useState(new Set());

  useEffect(() => {
    listWarehouses()
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  }, []);

  const updateLine = (index, changes) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...changes } : line)));

  // Auto-suggested split for whatever quantity is on the line right now —
  // called right after picking a product, and again on demand from the
  // editor's own "Auto-split" button. Best-effort: a failure just leaves the
  // rep to build the split manually instead of blocking the form.
  const refreshAllocation = async (index, productId, quantity) => {
    if (!productId || !quantity) return;
    setRefreshingIndexes((current) => new Set(current).add(index));
    try {
      const suggestion = await suggestAllocation(productId, quantity);
      updateLine(index, { allocations: normalizeAllocations(suggestion) });
    } catch {
      toast.error('Could not compute a warehouse split — add one manually');
    } finally {
      setRefreshingIndexes((current) => {
        const next = new Set(current);
        next.delete(index);
        return next;
      });
    }
  };

  const selectProduct = (index, option) => {
    if (!option) {
      updateLine(index, { productId: '', productLabel: '', productType: undefined, allocations: undefined });
      return;
    }
    updateLine(index, {
      productId: String(option.value),
      productLabel: option.label,
      productListPrice: option.raw.listPrice,
      productTaxRate: option.raw.taxRate,
      productIsSubscribable: option.raw.isSubscribable,
      productType: option.raw.productType,
      // A different product invalidates whatever recurring choice applied to the old one.
      isRecurring: false,
      recurringCycle: '',
      suggestedAs: null,
      suggestedFromProductId: null,
      allocations: [],
    });
    if (isStockedProductType(option.raw.productType)) {
      const existingQuantity = Number(lines[index]?.quantity) || 1;
      refreshAllocation(index, option.value, existingQuantity);
    }
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const addSuggestion = (suggestion) => {
    const newIndex = lines.length;
    setLines((current) => [...current, lineFromSuggestion(suggestion)]);
    if (isStockedProductType(suggestion.product.productType)) {
      refreshAllocation(newIndex, suggestion.product.id, 1);
    }
  };
  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const currentProductIds = lines.filter((line) => line.productId).map((line) => Number(line.productId));

  const save = async (event) => {
    event.preventDefault();

    if (!source && !customerId) return toast.error('Choose a customer');
    if (lines.length === 0) return toast.error('Add at least one line');
    if (lines.some((line) => !line.productId)) return toast.error('Every line needs a product');

    for (const line of lines) {
      if (!isStockedProductType(line.productType) || !line.allocations) continue;
      const total = line.allocations.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
      if (total !== Number(line.quantity)) {
        return toast.error(`${line.productLabel}: warehouse split (${total}) must add up to the quantity (${line.quantity})`);
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        ...(source ? { sourceQuotationId: source.id } : { customerId: Number(customerId) }),
        lines: lines.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          discountPercent: Number(line.discountPercent),
          isRecurring: line.isRecurring,
          ...(line.isRecurring ? { recurringCycle: line.recurringCycle } : {}),
          ...(line.suggestedAs
            ? { suggestedAs: line.suggestedAs, suggestedFromProductId: line.suggestedFromProductId }
            : {}),
          ...(isStockedProductType(line.productType) && line.allocations?.length
            ? { allocations: line.allocations.map((row) => ({ warehouseId: row.warehouseId, quantity: Number(row.quantity) })) }
            : {}),
        })),
      };

      const quotation = await createQuotation(payload);
      toast.success(source ? `Requoted as ${quotation.code}` : `${quotation.code} created`);
      onCreated(quotation);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not create quotation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfigModal
      title={source ? `Create New Quotation from ${source.code}` : 'New Quotation'}
      onClose={onClose}
      onSubmit={save}
      isSaving={isSaving}
    >
      {source ? (
        <p className="text-sm text-slate-600">
          Customer <span className="font-medium text-slate-900">{source.customer.name}</span>, inherited
          from {source.code} — lines below start as a copy of that quotation's, re-priced against current
          rates. A line whose product is no longer sold will need to be replaced before this can be saved.
        </p>
      ) : (
        <SearchSelect
          label="Customer"
          value={customerId}
          displayValue={customerLabel}
          onSelect={(option) => {
            setCustomerId(option ? String(option.value) : '');
            setCustomerLabel(option ? option.label : '');
          }}
          search={searchCustomers}
          placeholder="Type to search customers…"
        />
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Lines</span>
        <Button type="button" size="sm" variant="secondary" onClick={addLine}>
          <Plus className="size-4" aria-hidden="true" />
          Add line
        </Button>
      </div>

      <QuotationLineRows
        lines={lines}
        onUpdateLine={updateLine}
        onSelectProduct={selectProduct}
        onRemoveLine={removeLine}
        warehouses={warehouses}
        onAutoSplit={(index) => refreshAllocation(index, Number(lines[index].productId), Number(lines[index].quantity))}
        refreshingIndexes={refreshingIndexes}
      />

      <QuotationSuggestions productIds={currentProductIds} onAdd={addSuggestion} />
    </ConfigModal>
  );
};

export default QuotationFormModal;
