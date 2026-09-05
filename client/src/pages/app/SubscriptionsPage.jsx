import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import toast from 'react-hot-toast';

import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { listSubscriptions } from '../../api/subscriptions';
import { formatINR } from '../../lib/currency';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_RENEWAL_APPROVAL', label: 'Awaiting approval' },
  { value: 'PAST_DUE', label: 'Past due' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const CYCLE_LABEL = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };

const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    listSubscriptions(status ? { status } : {})
      .then(setSubscriptions)
      .catch(() => toast.error('Could not load subscriptions'))
      .finally(() => setIsLoading(false));
  }, [status]);

  const columns = [
    { key: 'product', header: 'Product', render: (row) => row.product.name },
    { key: 'customer', header: 'Customer', render: (row) => row.customer.name },
    { key: 'cycle', header: 'Billing', render: (row) => CYCLE_LABEL[row.cycle] ?? row.cycle },
    { key: 'quantity', header: 'Qty', align: 'right' },
    {
      key: 'upcomingCharge',
      header: 'Upcoming charge',
      align: 'right',
      render: (row) => formatINR(row.upcomingCharge),
    },
    { key: 'nextBillingDate', header: 'Next billing', render: (row) => formatDate(row.nextBillingDate) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} dot /> },
  ];

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Every recurring line, its billing schedule, and where it stands." />

      <div className="mb-4">
        <FilterBar options={FILTERS} value={status} onChange={setStatus} />
      </div>

      <DataTable
        columns={columns}
        rows={isLoading ? [] : subscriptions}
        onRowClick={(row) => navigate(`/workspace/subscriptions/${row.id}`)}
        emptyIcon={Repeat}
        emptyTitle={isLoading ? 'Loading…' : 'No subscriptions yet'}
        emptyDescription={isLoading ? undefined : 'A subscription appears here once a recurring quotation line is confirmed.'}
      />
    </div>
  );
};

export default SubscriptionsPage;
