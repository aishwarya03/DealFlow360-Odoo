import { useEffect, useState } from 'react';
import { Edit, Package, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import ConfigModal from '../../components/ConfigModal';
import DataTable from '../../components/DataTable';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { listProducts, createProduct, deactivateProduct, updateProduct, uploadProductImage } from '../../api/products';
import { listCategories } from '../../api/categories';

const formatMoney = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const typeTone = {
  GOODS: 'text-slate-700',
  SERVICE: 'text-blue-700',
  COMBO: 'text-slate-700',
};

/*
 * Read-only for now: proves an authenticated, role-aware request round-trips
 * against the real catalog API. Create/edit is ADMIN-only server-side
 * (server/src/modules/products/product.routes.js) — the "New Product"
 * button is gated the same way here, but only as a UX convenience; the
 * server enforces it regardless.
 */
const ProductsPage = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({});
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    listProducts({ includeInactive: 'true', limit: 100 })
      .then((result) => setProducts(result.products))
      .catch(() => toast.error('Could not load products'))
      .finally(() => setIsLoading(false));
    listCategories().then(setCategories).catch(() => toast.error('Could not load categories'));
  }, []);

  const openForm = (product = null) => {
    setEditing(product ?? {});
    setImageFile(null);
    setForm(product ? {
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      productType: product.productType,
      categoryId: product.category?.id ?? '',
      unit: product.unit,
      isSubscribable: product.isSubscribable,
      listPrice: product.listPrice,
      costPrice: product.costPrice,
      taxRate: product.taxRate,
    } : {
      sku: '', name: '', description: '', productType: 'GOODS', categoryId: '',
      unit: 'unit', isSubscribable: false, listPrice: '', costPrice: '', taxRate: 0,
    });
  };

  const change = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
  }));

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        listPrice: Number(form.listPrice),
        costPrice: Number(form.costPrice),
        taxRate: Number(form.taxRate),
      };
      const saved = editing.id ? await updateProduct(editing.id, payload) : await createProduct(payload);
      const withImage = imageFile ? await uploadProductImage(saved.id, imageFile) : saved;
      setProducts((current) => editing.id
        ? current.map((product) => product.id === saved.id ? withImage : product)
        : [withImage, ...current]);
      toast.success(editing.id ? 'Product updated' : 'Product created');
      setEditing(null);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not save product');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Deactivate ${product.name}?`)) return;
    try {
      const updated = await deactivateProduct(product.id);
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Product deactivated');
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not deactivate product');
    }
  };

  const columns = [
    {
      key: 'image',
      header: '',
      width: '44px',
      render: (row) =>
        row.imageUrl ? (
          <img
            src={`${import.meta.env.VITE_API_URL}${row.imageUrl}`}
            alt=""
            className="size-8 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-md border border-dashed border-slate-200 text-slate-300">
            <Package className="size-4" aria-hidden="true" />
          </span>
        ),
    },
    { key: 'sku', header: 'SKU', render: (row) => <span className="font-medium">{row.sku}</span> },
    { key: 'name', header: 'Name' },
    {
      key: 'category',
      header: 'Category',
      // category.path is the "Hardware / Computers" breadcrumb the API
      // computes; falls back to the bare name if a product's category has no
      // parent, or to an em dash if the category lookup somehow failed.
      render: (row) => row.category?.path ?? row.category?.name ?? '—',
    },
    {
      key: 'productType',
      header: 'Type',
      render: (row) => <span className={typeTone[row.productType]}>{row.productType}</span>,
    },
    {
      key: 'isSubscribable',
      header: 'Plan',
      align: 'center',
      render: (row) => (row.isSubscribable ? 'Yes' : '—'),
    },
    { key: 'listPrice', header: 'List price', align: 'right', render: (row) => formatMoney(row.listPrice) },
    {
      key: 'marginPercent',
      header: 'Margin',
      align: 'right',
      render: (row) => `${row.marginPercent}%`,
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
      render: (row) => user.role === 'ADMIN' && (
        <span className="inline-flex gap-1">
          <button type="button" onClick={() => openForm(row)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${row.name}`}>
            <Edit className="size-4" aria-hidden="true" />
          </button>
          {row.isActive && <button type="button" onClick={() => remove(row)} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label={`Deactivate ${row.name}`}>
            <Trash2 className="size-4" aria-hidden="true" />
          </button>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="The catalog every quotation is built from."
        actions={
          user.role === 'ADMIN' && (
            <Button
              size="sm"
              onClick={() => openForm()}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Product
            </Button>
          )
        }
      />

      {editing && (
        <ConfigModal title={editing.id ? 'Edit Product' : 'New Product'} onClose={() => setEditing(null)} onSubmit={save} isSaving={isSaving}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="SKU" name="sku" value={form.sku} onChange={change('sku')} required />
            <Input label="Name" name="name" value={form.name} onChange={change('name')} required />
            <Input label="Description" name="description" value={form.description} onChange={change('description')} />
            <label className="text-sm font-medium text-slate-700">Category<select className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.categoryId} onChange={change('categoryId')} required><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.path ?? category.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Type<select className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.productType} onChange={change('productType')}><option value="GOODS">Goods</option><option value="SERVICE">Service</option><option value="COMBO">Combo</option></select></label>
            <Input label="Unit" name="unit" value={form.unit} onChange={change('unit')} required />
            <Input label="List price" name="listPrice" type="number" min="0" value={form.listPrice} onChange={change('listPrice')} required />
            <Input label="Cost price" name="costPrice" type="number" min="0" value={form.costPrice} onChange={change('costPrice')} required />
            <Input label="Tax rate (%)" name="taxRate" type="number" min="0" max="100" value={form.taxRate} onChange={change('taxRate')} />
            <Input label="Product image" name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files[0])} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isSubscribable} onChange={change('isSubscribable')} /> Subscribable product</label>
        </ConfigModal>
      )}

      <DataTable
        columns={columns}
        rows={isLoading ? [] : products}
        emptyIcon={Package}
        emptyTitle={isLoading ? 'Loading…' : 'No products yet'}
      />
    </div>
  );
};

export default ProductsPage;
