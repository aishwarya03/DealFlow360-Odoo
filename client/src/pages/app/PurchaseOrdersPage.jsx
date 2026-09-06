import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, PackageCheck, Plus, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import ConfigModal from '../../components/ConfigModal';
import DataTable from '../../components/DataTable';
import Input from '../../components/Input';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelPurchaseOrder,
  completePurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  markPurchaseOrderOrdered,
} from '../../api/purchaseOrders';
import { listVendors } from '../../api/vendors';
import { listProducts } from '../../api/products';
import { listWarehouses } from '../../api/warehouses';

const emptyForm = () => ({ vendorId: '', productId: '', warehouseId: '', quantity: 1, notes: '' });

/*
 * A purchase order IS the backorder — its own status carries the backorder
 * through DRAFT (placed) -> ORDERED (sent to the vendor) -> DONE (received,
 * which is also the moment the server increases stock for that product/
 * warehouse — see purchaseOrder.service.js's markDone).
 */
const PurchaseOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  const loadOrders = () =>
    listPurchaseOrders()
      .then(setOrders)
      .catch(() => toast.error('Could not load purchase orders'))
      .finally(() => setIsLoading(false));

  useEffect(() => {
    loadOrders();
    listVendors().then(setVendors).catch(() => toast.error('Could not load vendors'));
    listProducts({ includeInactive: 'false', limit: 100 })
      .then((result) => setProducts(result.products))
      .catch(() => toast.error('Could not load products'));
    listWarehouses().then(setWarehouses).catch(() => toast.error('Could not load warehouses'));
  }, []);

  const openForm = () => {
    setIsCreating(true);
    setForm(emptyForm());
  };

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Picking a product pre-fills its preferred vendor, if one is configured —
  // the whole point of Product.preferredVendorId.
  const changeProduct = (event) => {
    const productId = event.target.value;
    const product = products.find((item) => String(item.id) === productId);
    setForm((current) => ({
      ...current,
      productId,
      vendorId: product?.preferredVendor?.id ? String(product.preferredVendor.id) : current.vendorId,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        vendorId: Number(form.vendorId),
        productId: Number(form.productId),
        warehouseId: Number(form.warehouseId),
        quantity: Number(form.quantity),
        notes: form.notes || undefined,
      };
      const saved = await createPurchaseOrder(payload);
      setOrders((current) => [saved, ...current]);
      toast.success('Purchase order placed');
      setIsCreating(false);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not place purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = (action, successMessage) => async (order) => {
    try {
      const updated = await action(order.id);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(successMessage);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Action failed');
    }
  };

  const sendToVendor = runAction(markPurchaseOrderOrdered, 'Sent to vendor');
  const receive = runAction(completePurchaseOrder, 'Received — stock updated');
  const cancel = runAction(cancelPurchaseOrder, 'Purchase order cancelled');

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
    { key: 'vendor', header: 'Vendor', render: (row) => row.vendor?.name },
    { key: 'warehouse', header: 'Warehouse', render: (row) => row.warehouse?.code },
    { key: 'quantity', header: 'Quantity', align: 'right' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} dot /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        user.role === 'ADMIN' && (
          <span className="inline-flex gap-1">
            {row.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => sendToVendor(row)}
                className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                aria-label="Send to vendor"
                title="Send to vendor"
              >
                <Send className="size-4" />
              </button>
            )}
            {(row.status === 'DRAFT' || row.status === 'ORDERED') && (
              <>
                <button
                  type="button"
                  onClick={() => receive(row)}
                  className="rounded p-1.5 text-green-600 hover:bg-green-50"
                  aria-label="Mark received"
                  title="Mark received — increases stock"
                >
                  <PackageCheck className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => cancel(row)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <Ban className="size-4" />
                </button>
              </>
            )}
            {row.status === 'DONE' && <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />}
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Backorders placed with a vendor. Marking one received increases stock for that product."
        actions={
          user.role === 'ADMIN' && (
            <Button size="sm" onClick={openForm}>
              <Plus className="size-4" aria-hidden="true" />
              New Purchase Order
            </Button>
          )
        }
      />

      {isCreating && (
        <ConfigModal
          title="New Purchase Order"
          onClose={() => setIsCreating(false)}
          onSubmit={save}
          isSaving={isSaving}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Product
              <select
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={form.productId}
                onChange={changeProduct}
                required
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Vendor
              <select
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={form.vendorId}
                onChange={change('vendorId')}
                required
              >
                <option value="">Select vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Warehouse to receive into
              <select
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={form.warehouseId}
                onChange={change('warehouseId')}
                required
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Quantity"
              name="quantity"
              type="number"
              min="1"
              value={form.quantity}
              onChange={change('quantity')}
              required
            />
            <Input label="Notes" name="notes" value={form.notes} onChange={change('notes')} />
          </div>
        </ConfigModal>
      )}

      <DataTable
        columns={columns}
        rows={isLoading ? [] : orders}
        emptyIcon={PackageCheck}
        emptyTitle={isLoading ? 'Loading…' : 'No purchase orders yet'}
      />
    </div>
  );
};

export default PurchaseOrdersPage;
