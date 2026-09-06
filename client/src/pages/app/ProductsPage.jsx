import { useEffect, useState } from 'react';
import { Edit, Package, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import ConfigModal from '../../components/ConfigModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import CustomSelect from '../../components/CustomSelect';
import DataTable from '../../components/DataTable';
import FileUpload from '../../components/FileUpload';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import ProductRecommendationsPanel from '../../components/ProductRecommendationsPanel';
import Switch from '../../components/Switch';
import { useAuth } from '../../hooks/useAuth';
import {
  listProducts,
  createProduct,
  deactivateProduct,
  updateProduct,
  uploadProductImage,
  getProductSubscriptionPlans,
  updateProductSubscriptionPlans,
} from '../../api/products';
import { listCategories } from '../../api/categories';

const PLAN_CYCLES = [
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'QUARTERLY', label: 'Quarterly' },
  { key: 'YEARLY', label: 'Yearly' },
];

const emptyPlans = () => ({ MONTHLY: '', QUARTERLY: '', YEARLY: '' });

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
  const [confirmProduct, setConfirmProduct] = useState(null);

  useEffect(() => {
    listProducts({ includeInactive: 'true', limit: 100 })
      .then((result) => setProducts(result.products))
      .catch(() => toast.error('Could not load products'))
      .finally(() => setIsLoading(false));
    listCategories().then(setCategories).catch(() => {});
  }, []);

  const openForm = async (product = null) => {
    setEditing(product ?? {});
    setImageFile(null);
    setForm(
      product
        ? {
            sku: product.sku,
            name: product.name,
            description: product.description ?? '',
            categoryId: product.categoryId,
            productType: product.productType,
            unit: product.unit,
            listPrice: product.listPrice,
            costPrice: product.costPrice,
            taxRate: product.taxRate ?? 18,
            isSubscribable: product.isSubscribable,
            plans: emptyPlans(),
          }
        : {
            sku: '',
            name: '',
            description: '',
            categoryId: '',
            productType: 'GOODS',
            unit: 'UNIT',
            listPrice: '',
            costPrice: '',
            taxRate: 18,
            isSubscribable: false,
            plans: emptyPlans(),
          }
    );

    if (product?.id && product.isSubscribable) {
      try {
        const plans = await getProductSubscriptionPlans(product.id);
        const mapped = emptyPlans();
        plans.forEach((plan) => {
          if (mapped[plan.cycle] !== undefined) mapped[plan.cycle] = plan.amount;
        });
        setForm((current) => ({ ...current, plans: mapped }));
      } catch {
        // Leave plans as empty inputs if loading fails.
      }
    }
  };

  const change = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const changePlan = (cycle) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      plans: { ...current.plans, [cycle]: value },
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      let saved;
      if (editing.id) {
        saved = await updateProduct(editing.id, form);
      } else {
        saved = await createProduct(form);
      }

      if (imageFile) {
        saved = await uploadProductImage(saved.id, imageFile);
      }

      if (form.isSubscribable) {
        const plansPayload = Object.entries(form.plans || {})
          .filter(([, amount]) => amount !== '' && amount !== null && !Number.isNaN(Number(amount)))
          .map(([cycle, amount]) => ({ cycle, amount: Number(amount) }));
        await updateProductSubscriptionPlans(saved.id, plansPayload);
      }

      setProducts((current) =>
        editing.id
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current]
      );
      toast.success(editing.id ? 'Product updated' : 'Product created');
      setEditing(null);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not save product');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeactivate = async () => {
    if (!confirmProduct) return;
    try {
      const updated = await deactivateProduct(confirmProduct.id);
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Product deactivated');
      setConfirmProduct(null);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not deactivate product');
    }
  };

  const remove = (product) => setConfirmProduct(product);

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
            <CustomSelect
              label="Category"
              value={form.categoryId}
              onChange={(val) => setForm((prev) => ({ ...prev, categoryId: val }))}
              placeholder="Select category"
              options={categories.map((c) => ({ value: c.id, label: c.path ?? c.name }))}
              searchable
            />
            <CustomSelect
              label="Type"
              value={form.productType}
              onChange={(val) => setForm((prev) => ({ ...prev, productType: val }))}
              options={[
                { value: 'GOODS', label: 'Goods (Hardware)' },
                { value: 'SERVICE', label: 'Service' },
                { value: 'COMBO', label: 'Combo Bundle' },
              ]}
            />
            <Input label="Unit" name="unit" value={form.unit} onChange={change('unit')} required />
            <Input label="List price" name="listPrice" type="number" min="0" value={form.listPrice} onChange={change('listPrice')} required />
            <Input label="Cost price" name="costPrice" type="number" min="0" value={form.costPrice} onChange={change('costPrice')} required />
            <Input label="Tax rate (%)" name="taxRate" type="number" min="0" max="100" value={form.taxRate} onChange={change('taxRate')} />
            <div className="sm:col-span-2">
              <FileUpload
                label="Product image"
                file={imageFile}
                onChange={(file) => setImageFile(file)}
                currentImageUrl={editing.imageUrl}
              />
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Switch
              checked={form.isSubscribable}
              onChange={(checked) => setForm((prev) => ({ ...prev, isSubscribable: checked }))}
              label="Subscribable product"
              description="Enable recurring contract billing (monthly, quarterly, or yearly)"
            />
          </div>

          {editing.id ? (
            <ProductRecommendationsPanel productId={editing.id} />
          ) : (
            <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
              Save this product first to configure cross-sell and upsell recommendations.
            </p>
          )}

          {form.isSubscribable && (
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">Subscription plans</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Amount billed per cycle. Leave a cycle blank to leave it unconfigured — a customer can't select a
                cycle that has no amount set.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {PLAN_CYCLES.map(({ key, label }) => (
                  <Input
                    key={key}
                    label={`${label} amount`}
                    name={`plan-${key}`}
                    type="number"
                    min="0"
                    value={form.plans[key]}
                    onChange={changePlan(key)}
                  />
                ))}
              </div>
            </div>
          )}
        </ConfigModal>
      )}

      <DataTable
        columns={columns}
        rows={isLoading ? [] : products}
        emptyIcon={Package}
        emptyTitle={isLoading ? 'Loading…' : 'No products yet'}
      />

      {confirmProduct && (
        <ConfirmDialog
          isOpen={true}
          title={`Deactivate ${confirmProduct.name}?`}
          message={`SKU: ${confirmProduct.sku}. Deactivating will remove it from active quote selectors.`}
          tone="danger"
          confirmLabel="Deactivate"
          onConfirm={executeDeactivate}
          onClose={() => setConfirmProduct(null)}
        />
      )}
    </div>
  );
};

export default ProductsPage;
