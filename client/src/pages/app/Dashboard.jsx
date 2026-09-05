import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, Users, Warehouse } from 'lucide-react';

import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../hooks/useAuth';
import { listCustomers } from '../../api/customers';
import { listLowStock } from '../../api/inventory';
import { listProducts } from '../../api/products';
import { listWarehouses } from '../../api/warehouses';
import { ROLES } from '../../lib/roles';

/*
 * Every number here comes from a live endpoint — no placeholder statistics
 * (docs/DEMO_SCENARIO.md "Explicitly not doing: fabricated statistics
 * anywhere"). Quotation-derived metrics (deal health, discount anomalies)
 * join this dashboard once that slice exists.
 */
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listProducts(), listCustomers(), listWarehouses(), listLowStock()])
      .then(([products, customers, warehouses, lowStock]) => {
        if (cancelled) return;
        setCounts({
          products: products.length,
          customers: customers.length,
          warehouses: warehouses.length,
          lowStock: lowStock.length,
        });
      })
      .catch(() => !cancelled && setError(true));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        subtitle={ROLES[user.role]?.blurb}
      />

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Couldn't load dashboard data. Is the API running?
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Active products"
          value={counts?.products ?? '—'}
          onClick={() => navigate('/workspace/products')}
        />
        <StatCard
          icon={Users}
          label="Active customers"
          value={counts?.customers ?? '—'}
          onClick={() => navigate('/workspace/customers')}
        />
        <StatCard
          icon={Warehouse}
          label="Warehouses"
          value={counts?.warehouses ?? '—'}
          onClick={() => navigate('/workspace/warehouses')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low stock items"
          value={counts?.lowStock ?? '—'}
          tone={counts?.lowStock > 0 ? 'warning' : undefined}
          hint={counts?.lowStock > 0 ? 'Below reorder point' : undefined}
          onClick={() => navigate('/workspace/inventory')}
        />
      </div>
    </div>
  );
};

export default Dashboard;
