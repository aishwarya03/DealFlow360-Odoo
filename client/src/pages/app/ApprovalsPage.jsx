import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { listApprovalRequests } from '../../api/approvals';

const FILTERS = [
  { value: 'PENDING', label: 'Pending' },
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'RETURNED', label: 'Returned' },
];

// The server already scopes this list to the caller's own role — Sales
// Manager sees only requests currently waiting on a Sales Manager step,
// Finance only Finance, Admin sees everything (see approval.service.js's
// scopeToRole). This page is a queue, not a decision screen: acting on a
// step happens on the quotation's own detail page, where the lines and the
// reason it routed here are visible alongside the Approve/Reject/Return
// buttons — not duplicated here.
const ApprovalsPage = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listApprovalRequests(status ? { status } : {})
      .then(setRequests)
      .catch(() => toast.error('Could not load approvals'))
      .finally(() => setIsLoading(false));
  }, [status]);

  const columns = [
    {
      key: 'quotation',
      header: 'Quotation',
      render: (row) => <span className="font-medium">{row.quotation?.code}</span>,
    },
    { key: 'customer', header: 'Customer', render: (row) => row.quotation?.customer?.name },
    {
      key: 'level',
      header: 'Routing',
      render: (row) => (row.approvalLevel === 'MANAGER_FINANCE' ? 'Manager + Finance' : 'Manager only'),
    },
    {
      key: 'step',
      header: 'Waiting on',
      render: (row) => {
        const active = row.steps.find((step) => step.status === 'ACTIVE');
        return active ? (active.role === 'SALES_MANAGER' ? 'Sales Manager' : 'Finance') : '—';
      },
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} dot /> },
    { key: 'createdAt', header: 'Opened', render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Quotations routed to you for a discount-governance decision." />

      <div className="mb-4">
        <FilterBar options={FILTERS} value={status} onChange={setStatus} />
      </div>

      <DataTable
        columns={columns}
        rows={isLoading ? [] : requests}
        onRowClick={(row) => navigate(`/workspace/quotations/${row.quotation.id}`)}
        emptyIcon={ShieldCheck}
        emptyTitle={isLoading ? 'Loading…' : 'Nothing waiting on you'}
      />
    </div>
  );
};

export default ApprovalsPage;
