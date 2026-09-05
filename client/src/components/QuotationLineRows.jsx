import { Trash2 } from 'lucide-react';

import { searchProducts } from '../lib/quotationLines';
import { formatINR } from '../lib/currency';
import Input from './Input';
import SearchSelect from './SearchSelect';

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand-600';

// The repeating product/qty/discount/recurring row, shared by the new-
// quotation form and the edit-lines modal so the two never drift apart.
const QuotationLineRows = ({ lines, onUpdateLine, onSelectProduct, onRemoveLine }) => (
  <div className="space-y-3">
    {lines.map((line, index) => (
      <div key={index} className="grid grid-cols-12 items-start gap-2 rounded-md border border-slate-200 p-3">
        <div className="col-span-5">
          <SearchSelect
            label="Product"
            value={line.productId}
            displayValue={line.productLabel}
            onSelect={(option) => onSelectProduct(index, option)}
            search={searchProducts}
            placeholder="Type to search products…"
          />
          {line.productListPrice !== undefined && (
            <p className="mt-1 text-xs text-slate-400">
              {formatINR(line.productListPrice)} · GST {line.productTaxRate}%
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Input
            label="Qty"
            type="number"
            min="1"
            value={line.quantity}
            onChange={(event) => onUpdateLine(index, { quantity: event.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Input
            label="Discount %"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={line.discountPercent}
            onChange={(event) => onUpdateLine(index, { discountPercent: event.target.value })}
          />
        </div>

        <div className="col-span-2">
          {line.productIsSubscribable && (
            <>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={line.isRecurring}
                  onChange={(event) =>
                    onUpdateLine(index, {
                      isRecurring: event.target.checked,
                      recurringCycle: event.target.checked ? 'MONTHLY' : '',
                    })
                  }
                />
                Recurring
              </label>
              {line.isRecurring && (
                <select
                  value={line.recurringCycle}
                  onChange={(event) => onUpdateLine(index, { recurringCycle: event.target.value })}
                  className={selectClass}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              )}
            </>
          )}
        </div>

        <div className="col-span-1 flex justify-end pt-5">
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => onRemoveLine(index)}
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove line"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    ))}
  </div>
);

export default QuotationLineRows;
