import { CheckCircle2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { cn } from '../lib/cn';

const inputClass =
  'w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 tabular-nums';

// Per-line warehouse split, shown only for stocked (GOODS) products. Starts
// from a server-computed greedy suggestion (largest-available warehouse
// first, remainder to backorder — see inventory.service.js's
// computeAllocation) and stays fully editable: a rep can retarget a row to a
// different warehouse, change quantities, add a row, or remove one. Nothing
// here reserves stock — this only records intent until the quotation is
// actually confirmed (see quotation.service.js's reserveStockForQuotation).
const WarehouseSplitEditor = ({ allocations, warehouses, quantity, onChange, onAutoSplit, isRefreshing }) => {
  const total = allocations.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const mismatch = total !== quantity;

  const updateRow = (index, changes) =>
    onChange(allocations.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  const removeRow = (index) => onChange(allocations.filter((_, i) => i !== index));

  const addRow = () => {
    const used = new Set(allocations.map((row) => row.warehouseId));
    const next = warehouses.find((warehouse) => !used.has(warehouse.id));
    onChange([
      ...allocations,
      {
        warehouseId: next ? next.id : null,
        warehouseCode: next?.code ?? null,
        warehouseName: next?.name ?? 'Backorder',
        quantity: 0,
      },
    ]);
  };

  const warehouseOptions = [
    { value: '', label: 'Backorder (Drop-ship / Pending)', badge: 'Backorder' },
    ...warehouses.map((w) => ({
      value: String(w.id),
      label: `${w.code} — ${w.name}`,
      badge: w.code,
    })),
  ];

  return (
    <div className="col-span-12 mt-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Warehouse Stock Allocation
          </span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  !mismatch ? 'bg-emerald-500' : 'bg-amber-500'
                )}
                style={{
                  width: `${Math.min(100, quantity > 0 ? (total / quantity) * 100 : 0)}%`,
                }}
              />
            </div>
            <span
              className={cn(
                'text-[11px] font-semibold tabular-nums',
                !mismatch ? 'text-emerald-700' : 'text-amber-700'
              )}
            >
              {total} of {quantity} allocated
            </span>
            {!mismatch && total > 0 && (
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onAutoSplit}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-xs font-medium text-brand-600 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={cn('size-3', isRefreshing && 'animate-spin')}
            aria-hidden="true"
          />
          Auto-split live stock
        </button>
      </div>

      {allocations.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">
          No split allocated yet — click &ldquo;Auto-split live stock&rdquo; or add a warehouse.
        </p>
      ) : (
        <div className="space-y-2">
          {allocations.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 min-w-[14rem]">
                <CustomSelect
                  value={row.warehouseId ? String(row.warehouseId) : ''}
                  onChange={(val) => {
                    const id = val ? Number(val) : null;
                    const warehouse = warehouses.find((w) => w.id === id);
                    updateRow(index, {
                      warehouseId: id,
                      warehouseCode: warehouse?.code ?? null,
                      warehouseName: warehouse?.name ?? 'Backorder',
                    });
                  }}
                  options={warehouseOptions}
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">Qty:</span>
                <input
                  type="number"
                  min="0"
                  value={row.quantity}
                  onChange={(event) =>
                    updateRow(index, { quantity: event.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <button
                type="button"
                onClick={() => removeRow(index)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Remove allocation"
                title="Remove warehouse line"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add another warehouse split
      </button>
    </div>
  );
};

export default WarehouseSplitEditor;
