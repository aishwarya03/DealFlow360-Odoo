import { useEffect, useState } from 'react';
import { Edit, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import ConfigModal from '../../components/ConfigModal';
import DataTable from '../../components/DataTable';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { createWarehouse, deactivateWarehouse, listWarehouses, updateWarehouse } from '../../api/warehouses';

const formatMoney = (value) => `₹${Number(value).toLocaleString('en-IN')}`;

const WarehousesPage = () => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listWarehouses({ includeInactive: 'true' })
      .then(setWarehouses)
      .catch(() => toast.error('Could not load warehouses'))
      .finally(() => setIsLoading(false));
  }, []);

  const openForm = (warehouse = null) => {
    setEditing(warehouse ?? {});
    setForm(warehouse ? { code: warehouse.code, name: warehouse.name, city: warehouse.city ?? '', shippingCostPerShipment: warehouse.shippingCostPerShipment, priority: warehouse.priority } : { code: '', name: '', city: '', shippingCostPerShipment: 0, priority: 100 });
  };
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const save = async (event) => {
    event.preventDefault(); setIsSaving(true);
    try {
      const payload = { ...form, shippingCostPerShipment: Number(form.shippingCostPerShipment), priority: Number(form.priority) };
      const saved = editing.id ? await updateWarehouse(editing.id, payload) : await createWarehouse(payload);
      setWarehouses((current) => editing.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      toast.success(editing.id ? 'Warehouse updated' : 'Warehouse created'); setEditing(null);
    } catch (error) { toast.error(error.response?.data?.message ?? 'Could not save warehouse'); }
    finally { setIsSaving(false); }
  };
  const remove = async (warehouse) => {
    if (!window.confirm(`Deactivate ${warehouse.name}?`)) return;
    try { const updated = await deactivateWarehouse(warehouse.id); setWarehouses((current) => current.map((item) => item.id === updated.id ? updated : item)); toast.success('Warehouse deactivated'); }
    catch (error) { toast.error(error.response?.data?.message ?? 'Could not deactivate warehouse'); }
  };

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
    { key: 'actions', header: 'Actions', align: 'right', render: (row) => user.role === 'ADMIN' && <span className="inline-flex gap-1"><button type="button" onClick={() => openForm(row)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${row.name}`}><Edit className="size-4" /></button>{row.isActive && <button type="button" onClick={() => remove(row)} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label={`Deactivate ${row.name}`}><Trash2 className="size-4" /></button>}</span> },
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
              onClick={() => openForm()}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Warehouse
            </Button>
          )
        }
      />
      {editing && <ConfigModal title={editing.id ? 'Edit Warehouse' : 'New Warehouse'} onClose={() => setEditing(null)} onSubmit={save} isSaving={isSaving}>
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Code" name="code" value={form.code} onChange={change('code')} required /><Input label="Name" name="name" value={form.name} onChange={change('name')} required /><Input label="City" name="city" value={form.city} onChange={change('city')} /><Input label="Shipping cost" name="shippingCostPerShipment" type="number" min="0" value={form.shippingCostPerShipment} onChange={change('shippingCostPerShipment')} /><Input label="Priority" name="priority" type="number" min="1" value={form.priority} onChange={change('priority')} required /></div>
      </ConfigModal>}

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
