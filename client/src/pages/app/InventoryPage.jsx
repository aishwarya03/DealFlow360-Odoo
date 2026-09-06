import { useEffect, useState } from 'react';
import { Boxes, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

import ConfigModal from '../../components/ConfigModal';
import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import { SkeletonTable } from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { listLowStock, listStock, updateStock } from '../../api/inventory';

const FILTERS = [
  { value: 'all', label: 'All stock' },
  { value: 'low', label: 'Needs reorder' },
];

/*
 * availableQty is never stored server-side — it's onHand minus reserved,
 * computed at read time (server/src/modules/inventory/inventory.service.js).
 * Rendered here exactly as the API returns it, not recomputed client-side,
 * so there is one formula, one place.
 */
const InventoryPage = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [stock, setStock] = useState([]);
  // Tracks which filter the current `stock` was loaded for, so isLoading is
  // derived (loadedFilter !== filter) instead of set synchronously inside
  // the effect — the latter causes an extra cascading render.
  const [loadedFilter, setLoadedFilter] = useState(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setError(false);
    const loader = filter === 'low' ? listLowStock() : listStock();

    loader
      .then((rows) => {
        setStock(rows);
        setLoadedFilter(filter);
      })
      .catch(() => {
        toast.error('Could not load stock');
        setError(true);
      });
  }, [filter]);

  const isLoading = loadedFilter !== filter && !error;

  const openForm = (row) => {
    setEditing(row);
    setForm({
      onHandQty: row.onHandQty,
      reorderPoint: row.reorderPoint,
      reorderQty: row.reorderQty,
      reason: '',
    });
  };

  const change = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editing || user.role !== 'ADMIN') return;

    setIsSaving(true);
    try {
      const saved = await updateStock({
        warehouseId: editing.warehouseId,
        productId: editing.productId,
        onHandQty: Number(form.onHandQty),
        reorderPoint: Number(form.reorderPoint),
        reorderQty: Number(form.reorderQty),
        reason: form.reason,
      });
      setStock((current) => current.map((row) => row.id === saved.id ? saved : row));
      toast.success('Inventory updated');
      setEditing(null);
    } catch (saveError) {
      toast.error(saveError.response?.data?.message ?? 'Could not update inventory');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <span className="font-medium">{row.product?.sku}</span>
          <span className="ml-2 text-slate-400">{row.product?.name}</span>
        </div>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', render: (row) => row.warehouse?.code },
    { key: 'onHandQty', header: 'On hand', align: 'right' },
    { key: 'reservedQty', header: 'Reserved', align: 'right' },
    { key: 'availableQty', header: 'Available', align: 'right' },
    {
      key: 'needsReorder',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <StatusBadge status={row.needsReorder ? 'BACKORDER' : 'COMPLETE'} dot />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => user.role === 'ADMIN' && (
        <button
          type="button"
          onClick={() => openForm(row)}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label={`Edit inventory for ${row.product?.name ?? row.product?.sku}`}
        >
          <Edit className="size-4" aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Stock of every product across every warehouse."
      />

      <FilterBar options={FILTERS} value={filter} onChange={setFilter} />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load inventory. Please try again in a moment.
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <SkeletonTable rows={6} cols={7} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={stock}
          getRowKey={(row) => row.id}
          emptyIcon={Boxes}
          emptyTitle="Nothing to show"
          emptyDescription={
            filter === 'low'
              ? 'No product is below its reorder point right now.'
              : 'Stock will appear here once inventory is recorded for a warehouse.'
          }
        />
      )}

      {editing && (
        <ConfigModal
          title={`Edit inventory: ${editing.product?.sku ?? 'Stock'}`}
          onClose={() => setEditing(null)}
          onSubmit={save}
          isSaving={isSaving}
        >
          <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {editing.product?.name} at {editing.warehouse?.code}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="On hand" name="onHandQty" type="number" min="0" value={form.onHandQty} onChange={change('onHandQty')} required />
            <Input label="Reorder point" name="reorderPoint" type="number" min="0" value={form.reorderPoint} onChange={change('reorderPoint')} required />
            <Input label="Reorder quantity" name="reorderQty" type="number" min="0" value={form.reorderQty} onChange={change('reorderQty')} required />
          </div>
          <Input label="Reason" name="reason" value={form.reason} onChange={change('reason')} minLength="3" maxLength="200" hint="Required for the stock movement audit trail." required />
        </ConfigModal>
      )}
    </div>
  );
};

export default InventoryPage;
