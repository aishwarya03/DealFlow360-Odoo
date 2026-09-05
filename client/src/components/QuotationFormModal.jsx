import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { listCustomers } from '../api/customers';
import { createQuotation } from '../api/quotations';
import { emptyLine, lineFromExisting } from '../lib/quotationLines';
import Button from './Button';
import ConfigModal from './ConfigModal';
import QuotationLineRows from './QuotationLineRows';
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
      // A different product invalidates whatever recurring choice applied to the old one.
      isRecurring: false,
      recurringCycle: '',
    });
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const save = async (event) => {
    event.preventDefault();

    if (!source && !customerId) return toast.error('Choose a customer');
    if (lines.length === 0) return toast.error('Add at least one line');
    if (lines.some((line) => !line.productId)) return toast.error('Every line needs a product');

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
      />
    </ConfigModal>
  );
};

export default QuotationFormModal;
