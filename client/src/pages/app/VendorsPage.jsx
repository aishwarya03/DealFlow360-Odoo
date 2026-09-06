import { useEffect, useState } from 'react';
import { Building2, Edit, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import ConfigModal from '../../components/ConfigModal';
import DataTable from '../../components/DataTable';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { createVendor, deactivateVendor, listVendors, updateVendor } from '../../api/vendors';

const emptyForm = () => ({ name: '', address: '', email: '', phone: '', website: '' });

const VendorsPage = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listVendors({ includeInactive: 'true' })
      .then(setVendors)
      .catch(() => toast.error('Could not load vendors'))
      .finally(() => setIsLoading(false));
  }, []);

  const openForm = (vendor = null) => {
    setEditing(vendor ?? {});
    setForm(
      vendor
        ? {
            name: vendor.name,
            address: vendor.address ?? '',
            email: vendor.email ?? '',
            phone: vendor.phone ?? '',
            website: vendor.website ?? '',
          }
        : emptyForm()
    );
  };

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const saved = editing.id ? await updateVendor(editing.id, form) : await createVendor(form);
      setVendors((current) =>
        editing.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]
      );
      toast.success(editing.id ? 'Vendor updated' : 'Vendor created');
      setEditing(null);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not save vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (vendor) => {
    if (!window.confirm(`Deactivate ${vendor.name}?`)) return;
    try {
      const updated = await deactivateVendor(vendor.id);
      setVendors((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Vendor deactivated');
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not deactivate vendor');
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'address', header: 'Address', render: (row) => row.address ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
    {
      key: 'website',
      header: 'Website',
      render: (row) =>
        row.website ? (
          <a href={row.website} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
            {row.website}
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (row) => (row.isActive ? 'Active' : 'Inactive'),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        user.role === 'ADMIN' && (
          <span className="inline-flex gap-1">
            <button
              type="button"
              onClick={() => openForm(row)}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label={`Edit ${row.name}`}
            >
              <Edit className="size-4" />
            </button>
            {row.isActive && (
              <button
                type="button"
                onClick={() => remove(row)}
                className="rounded p-1.5 text-red-500 hover:bg-red-50"
                aria-label={`Deactivate ${row.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Suppliers a backorder can be placed with."
        actions={
          user.role === 'ADMIN' && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="size-4" aria-hidden="true" />
              New Vendor
            </Button>
          )
        }
      />

      {editing && (
        <ConfigModal
          title={editing.id ? 'Edit Vendor' : 'New Vendor'}
          onClose={() => setEditing(null)}
          onSubmit={save}
          isSaving={isSaving}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Vendor name" name="name" value={form.name} onChange={change('name')} required />
            <Input label="Email" name="email" type="email" value={form.email} onChange={change('email')} />
            <Input label="Phone" name="phone" value={form.phone} onChange={change('phone')} />
            <Input label="Website" name="website" value={form.website} onChange={change('website')} />
            <Input label="Address" name="address" value={form.address} onChange={change('address')} />
          </div>
        </ConfigModal>
      )}

      <DataTable
        columns={columns}
        rows={isLoading ? [] : vendors}
        emptyIcon={Building2}
        emptyTitle={isLoading ? 'Loading…' : 'No vendors yet'}
      />
    </div>
  );
};

export default VendorsPage;
