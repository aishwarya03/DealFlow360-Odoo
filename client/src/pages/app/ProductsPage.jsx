import { useEffect, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { listProducts } from '../../api/products';

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

  useEffect(() => {
    listProducts({ includeInactive: 'true' })
      .then(setProducts)
      .catch(() => toast.error('Could not load products'))
      .finally(() => setIsLoading(false));
  }, []);

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
              onClick={() => toast('Product form lands with the Quotation Builder slice.')}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Product
            </Button>
          )
        }
      />

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
