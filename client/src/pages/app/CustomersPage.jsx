import { useEffect, useState } from 'react';
import { Edit, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import ConfigModal from '../../components/ConfigModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { createCustomer, deactivateCustomer, listCustomers, updateCustomer } from '../../api/customers';

const tierTone = {
  GOLD: 'text-amber-700',
  SILVER: 'text-slate-600',
  BRONZE: 'text-orange-700',
};

const CAN_CREATE = ['ADMIN', 'SALES_REP', 'SALES_MANAGER'];

const emptyForm = () => ({ name: '', email: '', contactName: '', phone: '' });

const CustomersPage = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirmCustomer, setConfirmCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listCustomers({ includeInactive: 'true' })
      .then(setCustomers)
      .catch(() => toast.error('Could not load customers'))
      .finally(() => setIsLoading(false));
  }, []);

  const openForm = (customer = null) => {
    setEditing(customer ? { id: customer.id } : {});
    setForm(customer ? { name: customer.name, email: customer.email, contactName: customer.contactName ?? '', phone: customer.phone ?? '' } : emptyForm());
  };
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const save = async (event) => {
    event.preventDefault(); setIsSaving(true);
    try {
      const saved = editing.id ? await updateCustomer(editing.id, form) : await createCustomer(form);
      setCustomers((current) => editing.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      toast.success(editing.id ? 'Customer updated' : 'Customer created'); setEditing(null);
    } catch (error) { toast.error(error.response?.data?.message ?? 'Could not save customer'); }
    finally { setIsSaving(false); }
  };
  const executeDeactivate = async () => {
    if (!confirmCustomer) return;
    try {
      const updated = await deactivateCustomer(confirmCustomer.id);
      setCustomers((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Customer deactivated');
      setConfirmCustomer(null);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not deactivate customer');
    }
  };
  const remove = (customer) => setConfirmCustomer(customer);

  const columns = [
    { key: 'name', header: 'Company', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'email', header: 'Email' },
    {
      key: 'tier',
      header: 'Tier',
      render: (row) => <span className={tierTone[row.tier?.code]}>{row.tier?.name ?? '—'}</span>,
    },
    { key: 'contactName', header: 'Contact', render: (row) => row.contactName ?? '—' },
    {
      key: 'hasPortalAccess',
      header: 'Portal',
      align: 'center',
      render: (row) => (row.hasPortalAccess ? 'Enabled' : '—'),
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (row) => (row.isActive ? 'Active' : 'Inactive'),
    },
    { key: 'actions', header: 'Actions', align: 'right', render: (row) => CAN_CREATE.includes(user.role) && <span className="inline-flex gap-1"><button type="button" onClick={() => openForm(row)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${row.name}`}><Edit className="size-4" /></button>{user.role === 'ADMIN' && row.isActive && <button type="button" onClick={() => remove(row)} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label={`Deactivate ${row.name}`}><Trash2 className="size-4" /></button>}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Every company a quotation can be raised for."
        actions={
          CAN_CREATE.includes(user.role) && (
            <Button
              size="sm"
              onClick={() => openForm()}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Customer
            </Button>
          )
        }
      />
      {editing && <ConfigModal title={editing.id ? 'Edit Customer' : 'New Customer'} onClose={() => setEditing(null)} onSubmit={save} isSaving={isSaving}>
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Company name" name="name" value={form.name} onChange={change('name')} required /><Input label="Email" name="email" type="email" value={form.email} onChange={change('email')} required /><Input label="Contact name" name="contactName" value={form.contactName} onChange={change('contactName')} /><Input label="Phone" name="phone" value={form.phone} onChange={change('phone')} /></div>
      </ConfigModal>}

      <DataTable
        columns={columns}
        rows={isLoading ? [] : customers}
        emptyIcon={Users}
        emptyTitle={isLoading ? 'Loading…' : 'No customers yet'}
      />

      {confirmCustomer && (
        <ConfirmDialog
          isOpen={true}
          title={`Deactivate ${confirmCustomer.name}?`}
          message="This will hide the customer from active quotation lookups."
          tone="danger"
          confirmLabel="Deactivate"
          onConfirm={executeDeactivate}
          onClose={() => setConfirmCustomer(null)}
        />
      )}
    </div>
  );
};

export default CustomersPage;
