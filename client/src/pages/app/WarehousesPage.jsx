import { useEffect, useState } from 'react';
import { Plus, Warehouse as WarehouseIcon } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { listWarehouses } from '../../api/warehouses';

const formatMoney = (value) => `₹${Number(value).toLocaleString('en-IN')}`;

const WarehousesPage = () => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listWarehouses({ includeInactive: 'true' })
      .then(setWarehouses)
      .catch(() => toast.error('Could not load warehouses'))
      .finally(() => setIsLoading(false));
  }, []);

  const columns = [
    { key: 'code', header: 'Code', render: (row) => <span className="font-medium">{row.code}</span> },
    { key: 'name', header: 'Name' },
    { key: 'city', header: 'City', render: (row) => row.city ?? '—' },
    {
      key: 'shippingCostPerShipment',
      header: 'Cost / shipment',
      align: 'right',
      render: (row) => formatMoney(row.shippingCostPerShipment),
    },
    { key: 'priority', header: 'Priority', align: 'right' },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (row) => (row.isActive ? 'Active' : 'Inactive'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Warehouses"
        subtitle="Stocking locations, ordered cheapest-dispatch first — the order the fulfillment split will consider them in."
        actions={
          user.role === 'ADMIN' && (
            <Button
              size="sm"
              onClick={() => toast('Warehouse form lands with the Fulfillment slice.')}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Warehouse
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={isLoading ? [] : warehouses}
        emptyIcon={WarehouseIcon}
        emptyTitle={isLoading ? 'Loading…' : 'No warehouses yet'}
      />
    </div>
  );
};

export default WarehousesPage;
