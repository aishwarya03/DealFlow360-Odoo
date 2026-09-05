import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import QuotationFormModal from '../../components/QuotationFormModal';
import StatusBadge from '../../components/StatusBadge';
import { listQuotations } from '../../api/quotations';
import { useAuth } from '../../hooks/useAuth';
import { formatINR } from '../../lib/currency';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'UNDER_NEGOTIATION', label: 'Negotiating' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

// Create/edit is Sales Rep + Sales Manager only — the access matrix keeps a
// quotation as a rep's own work in progress (docs/SOURCE_OF_TRUTH.md §6).
const CAN_CREATE = ['SALES_REP', 'SALES_MANAGER'];

const QuotationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    listQuotations(status ? { status } : {})
      .then(setQuotations)
      .catch(() => toast.error('Could not load quotations'))
      .finally(() => setIsLoading(false));
  }, [status]);

  const columns = [
    { key: 'code', header: 'Quotation', render: (row) => <span className="font-medium">{row.code}</span> },
    { key: 'customer', header: 'Customer', render: (row) => row.customer.name },
    { key: 'owner', header: 'Owner', render: (row) => row.owner.name },
    {
      key: 'total',
      header: 'Value',
      align: 'right',
      render: (row) => formatINR(row.totals?.grandTotal ?? 0),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} dot />,
    },
    {
      key: 'lastActivityAt',
      header: 'Last activity',
      render: (row) => new Date(row.lastActivityAt).toLocaleString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Every quotation you can see, from draft to confirmed."
        actions={
          CAN_CREATE.includes(user.role) && (
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New Quotation
            </Button>
          )
        }
      />

      <div className="mb-4">
        <FilterBar options={FILTERS} value={status} onChange={setStatus} />
      </div>

      {isCreating && (
        <QuotationFormModal
          onClose={() => setIsCreating(false)}
          onCreated={(quotation) => {
            setIsCreating(false);
            navigate(`/workspace/quotations/${quotation.id}`);
          }}
        />
      )}

      <DataTable
        columns={columns}
        rows={isLoading ? [] : quotations}
        onRowClick={(row) => navigate(`/workspace/quotations/${row.id}`)}
        emptyIcon={FileText}
        emptyTitle={isLoading ? 'Loading…' : 'No quotations yet'}
      />
    </div>
  );
};

export default QuotationsPage;
