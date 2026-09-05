import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { listCustomers } from '../../api/customers';

const tierTone = {
  GOLD: 'text-amber-700',
  SILVER: 'text-slate-600',
  BRONZE: 'text-orange-700',
};

const CAN_CREATE = ['ADMIN', 'SALES_REP', 'SALES_MANAGER'];

const CustomersPage = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listCustomers({ includeInactive: 'true' })
      .then(setCustomers)
      .catch(() => toast.error('Could not load customers'))
      .finally(() => setIsLoading(false));
  }, []);

  const columns = [
    { key: 'name', header: 'Company', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'email', header: 'Email' },
    {
      key: 'tier',
      header: 'Tier',
      render: (row) => <span className={tierTone[row.tier]}>{row.tier}</span>,
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
              onClick={() => toast('Customer form lands with the Quotation Builder slice.')}
            >
              <Plus className="size-4" aria-hidden="true" />
              New Customer
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={isLoading ? [] : customers}
        emptyIcon={Users}
        emptyTitle={isLoading ? 'Loading…' : 'No customers yet'}
      />
    </div>
  );
};

export default CustomersPage;
