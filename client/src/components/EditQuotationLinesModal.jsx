import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { suggestAllocation } from '../api/inventory';
import { updateQuotationLines } from '../api/quotations';
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

// Only reachable while the quotation is DRAFT or UNDER_NEGOTIATION — the
// same statuses the backend accepts a PATCH for (quotation.service.js's
// LINES_EDITABLE_STATUSES). Editing while UNDER_NEGOTIATION immediately
// re-evaluates and re-routes on save (§4); the resulting quotation reflects
// that regardless of what this modal shows.
const EditQuotationLinesModal = ({ quotation, onClose, onUpdated }) => {
  const originalLineIds = quotation.lines.map((line) => line.id);
  const [lines, setLines] = useState(quotation.lines.map(lineFromExisting));
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

  // Auto-suggested split for the line's current quantity — called right
  // after picking a product, and again on demand from the editor's own
  // "Auto-split" button. Best-effort: a failure just leaves the rep to build
  // the split manually instead of blocking the form.
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
      isRecurring: false,
      recurringCycle: '',
      // A manually-picked product invalidates whatever suggestion attribution
      // this row may have carried in from lineFromSuggestion.
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

  // Suggestions are evaluated against whatever's on the form right now, so a
  // rep sees fresh cross-sell/upsell options as they add lines, not just
  // whatever was true when the modal opened.
  const currentProductIds = lines.filter((line) => line.productId).map((line) => Number(line.productId));

  const save = async (event) => {
    event.preventDefault();

    if (lines.length === 0) return toast.error('A quotation needs at least one line');
    if (lines.some((line) => !line.productId)) return toast.error('Every line needs a product');

    for (const line of lines) {
      if (!isStockedProductType(line.productType) || !line.allocations) continue;
      const total = line.allocations.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
      if (total !== Number(line.quantity)) {
        return toast.error(`${line.productLabel}: warehouse split (${total}) must add up to the quantity (${line.quantity})`);
      }
    }

    const remainingLineIds = new Set(lines.filter((line) => line.lineId).map((line) => line.lineId));
    const allocationPayload = (line) =>
      isStockedProductType(line.productType) && line.allocations?.length
        ? { allocations: line.allocations.map((row) => ({ warehouseId: row.warehouseId, quantity: Number(row.quantity) })) }
        : {};

    const changes = {
      remove: originalLineIds.filter((id) => !remainingLineIds.has(id)),
      update: lines
        .filter((line) => line.lineId)
        .map((line) => ({
          lineId: line.lineId,
          quantity: Number(line.quantity),
          discountPercent: Number(line.discountPercent),
          isRecurring: line.isRecurring,
          recurringCycle: line.isRecurring ? line.recurringCycle : null,
          ...allocationPayload(line),
        })),
      add: lines
        .filter((line) => !line.lineId)
        .map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          discountPercent: Number(line.discountPercent),
          isRecurring: line.isRecurring,
          ...(line.isRecurring ? { recurringCycle: line.recurringCycle } : {}),
          ...(line.suggestedAs
            ? { suggestedAs: line.suggestedAs, suggestedFromProductId: line.suggestedFromProductId }
            : {}),
          ...allocationPayload(line),
        })),
    };

    if (!changes.remove.length && !changes.update.length && !changes.add.length) {
      toast('Nothing changed');
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateQuotationLines(quotation.id, changes);
      toast.success('Lines updated');
      onUpdated(updated);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not update lines');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfigModal title={`Edit Lines — ${quotation.code}`} onClose={onClose} onSubmit={save} isSaving={isSaving}>
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

export default EditQuotationLinesModal;
