import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { updateQuotationLines } from '../api/quotations';
import { emptyLine, lineFromExisting } from '../lib/quotationLines';
import Button from './Button';
import ConfigModal from './ConfigModal';
import QuotationLineRows from './QuotationLineRows';

// Only reachable while the quotation is DRAFT or UNDER_NEGOTIATION — the
// same statuses the backend accepts a PATCH for (quotation.service.js's
// LINES_EDITABLE_STATUSES). Editing while UNDER_NEGOTIATION immediately
// re-evaluates and re-routes on save (§4); the resulting quotation reflects
// that regardless of what this modal shows.
const EditQuotationLinesModal = ({ quotation, onClose, onUpdated }) => {
  const originalLineIds = quotation.lines.map((line) => line.id);
  const [lines, setLines] = useState(quotation.lines.map(lineFromExisting));
  const [isSaving, setIsSaving] = useState(false);

  const updateLine = (index, changes) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...changes } : line)));

  const selectProduct = (index, option) => {
    if (!option) {
      updateLine(index, { productId: '', productLabel: '' });
      return;
    }
    updateLine(index, {
      productId: String(option.value),
      productLabel: option.label,
      productListPrice: option.raw.listPrice,
      productTaxRate: option.raw.taxRate,
      productIsSubscribable: option.raw.isSubscribable,
      isRecurring: false,
      recurringCycle: '',
    });
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const save = async (event) => {
    event.preventDefault();

    if (lines.length === 0) return toast.error('A quotation needs at least one line');
    if (lines.some((line) => !line.productId)) return toast.error('Every line needs a product');

    const remainingLineIds = new Set(lines.filter((line) => line.lineId).map((line) => line.lineId));

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
        })),
      add: lines
        .filter((line) => !line.lineId)
        .map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          discountPercent: Number(line.discountPercent),
          isRecurring: line.isRecurring,
          ...(line.isRecurring ? { recurringCycle: line.recurringCycle } : {}),
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
      />
    </ConfigModal>
  );
};

export default EditQuotationLinesModal;
