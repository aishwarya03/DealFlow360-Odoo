import { Trash2 } from 'lucide-react';

import { isStockedProductType, searchProducts } from '../lib/quotationLines';
import { formatINR } from '../lib/currency';
import CustomSelect from './CustomSelect';
import Input from './Input';
import SearchSelect from './SearchSelect';
import Switch from './Switch';
import WarehouseSplitEditor from './WarehouseSplitEditor';

// The repeating product/qty/discount/recurring row, shared by the new-
// quotation form and the edit-lines modal so the two never drift apart.
const QuotationLineRows = ({
  lines,
  onUpdateLine,
  onSelectProduct,
  onRemoveLine,
  warehouses = [],
  onAutoSplit,
  refreshingIndexes,
}) => (
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

        <div className="col-span-2 space-y-1.5 pt-0.5">
          {line.productIsSubscribable && (
            <>
              <Switch
                checked={line.isRecurring}
                onChange={(checked) =>
                  onUpdateLine(index, {
                    isRecurring: checked,
                    recurringCycle: checked ? 'MONTHLY' : '',
                  })
                }
                label="Recurring"
                size="sm"
              />
              {line.isRecurring && (
                <CustomSelect
                  value={line.recurringCycle}
                  onChange={(val) =>
                    onUpdateLine(index, { recurringCycle: val })
                  }
                  options={[
                    { value: 'MONTHLY', label: 'Monthly' },
                    { value: 'QUARTERLY', label: 'Quarterly' },
                    { value: 'YEARLY', label: 'Yearly' },
                  ]}
                  size="sm"
                />
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

        {line.productId && isStockedProductType(line.productType) && (
          <WarehouseSplitEditor
            allocations={line.allocations ?? []}
            warehouses={warehouses}
            quantity={Number(line.quantity) || 0}
            onChange={(allocations) => onUpdateLine(index, { allocations })}
            onAutoSplit={() => onAutoSplit(index)}
            isRefreshing={refreshingIndexes?.has(index)}
          />
        )}
      </div>
    ))}
  </div>
);

export default QuotationLineRows;
