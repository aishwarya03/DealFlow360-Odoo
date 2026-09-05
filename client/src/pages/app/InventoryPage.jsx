import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import toast from 'react-hot-toast';

import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { listLowStock, listStock } from '../../api/inventory';

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
  const [filter, setFilter] = useState('all');
  const [stock, setStock] = useState([]);
  // Tracks which filter the current `stock` was loaded for, so isLoading is
  // derived (loadedFilter !== filter) instead of set synchronously inside
  // the effect — the latter causes an extra cascading render.
  const [loadedFilter, setLoadedFilter] = useState(null);

  useEffect(() => {
    const loader = filter === 'low' ? listLowStock() : listStock();

    loader
      .then((rows) => {
        setStock(rows);
        setLoadedFilter(filter);
      })
      .catch(() => toast.error('Could not load stock'));
  }, [filter]);

  const isLoading = loadedFilter !== filter;

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
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock of every product across every warehouse."
      />

      <FilterBar options={FILTERS} value={filter} onChange={setFilter} className="mb-4" />

      <DataTable
        columns={columns}
        rows={isLoading ? [] : stock}
        getRowKey={(row) => row.id}
        emptyIcon={Boxes}
        emptyTitle={isLoading ? 'Loading…' : 'Nothing to show'}
        emptyDescription={
          filter === 'low' ? 'No product is below its reorder point right now.' : undefined
        }
      />
    </div>
  );
};

export default InventoryPage;
