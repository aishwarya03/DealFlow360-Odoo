import { Plus, RefreshCw, Trash2 } from 'lucide-react';

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-brand-600';
const inputClass =
  'w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-brand-600';

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

  return (
    <div className="col-span-12 mt-1 rounded-md border border-dashed border-slate-200 bg-slate-50 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Warehouse split</span>
        <div className="flex items-center gap-3">
          {mismatch && (
            <span className="text-xs font-medium text-amber-600">
              {total} of {quantity} allocated
            </span>
          )}
          <button
            type="button"
            onClick={onAutoSplit}
            disabled={isRefreshing}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Auto-split
          </button>
        </div>
      </div>

      {allocations.length === 0 ? (
        <p className="text-xs text-slate-400">No split yet — click Auto-split.</p>
      ) : (
        <div className="space-y-1.5">
          {allocations.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={row.warehouseId ?? ''}
                onChange={(event) => {
                  const id = event.target.value ? Number(event.target.value) : null;
                  const warehouse = warehouses.find((w) => w.id === id);
                  updateRow(index, {
                    warehouseId: id,
                    warehouseCode: warehouse?.code ?? null,
                    warehouseName: warehouse?.name ?? 'Backorder',
                  });
                }}
                className={selectClass}
              >
                <option value="">Backorder</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={row.quantity}
                onChange={(event) => updateRow(index, { quantity: event.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove allocation"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <Plus className="size-3" aria-hidden="true" />
        Add warehouse
      </button>
    </div>
  );
};

export default WarehouseSplitEditor;
