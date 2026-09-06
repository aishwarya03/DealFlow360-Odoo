import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileText, LayoutGrid, List, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { actOnStep } from '../../api/approvals';
import { confirmQuotation, listQuotations, submitQuotation, withdrawQuotation } from '../../api/quotations';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import FilterBar from '../../components/FilterBar';
import KanbanBoard from '../../components/KanbanBoard';
import NoteModal from '../../components/NoteModal';
import PageHeader from '../../components/PageHeader';
import QuotationFormModal from '../../components/QuotationFormModal';
import SearchInput from '../../components/SearchInput';
import { Skeleton, SkeletonTable } from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { cn } from '../../lib/cn';
import { formatINR } from '../../lib/currency';
import { resolveStatus } from '../../lib/status';

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

const KANBAN_COLUMN_KEYS = [
  'DRAFT',
  'PENDING_APPROVAL',
  'UNDER_NEGOTIATION',
  'APPROVED',
  'CONFIRMED',
  'REJECTED',
  'WITHDRAWN',
];

const TONE_BORDER = {
  neutral: 'border-l-slate-400',
  info: 'border-l-blue-500',
  success: 'border-l-green-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
};

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

const avatarClass = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[hash];
};

const initials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Create/edit is Sales Rep + Sales Manager only — the access matrix keeps a
// quotation as a rep's own work in progress (docs/SOURCE_OF_TRUTH.md §6).
const CAN_CREATE = ['SALES_REP', 'SALES_MANAGER'];

// Mirrors approval.service.js's scopeToRole: a step is actionable by the
// matching role, or by Admin regardless of role.
const canActOnStep = (step, role) => step && (step.role === role || role === 'ADMIN');

/*
 * The Kanban board is a navigation/triage view, not a free "set the status"
 * control — a quotation's status is a governed state machine (§4), and only
 * three transitions are ever rep-initiated from outside the Approvals queue:
 * Submit (DRAFT -> …), Confirm and Withdraw (APPROVED/UNDER_NEGOTIATION ->
 * …). This mirrors QuotationDetailPage's action buttons exactly — dragging a
 * card is just a faster way to reach the same three buttons, never a
 * shortcut around approval.
 */
const dropAction = (fromKey, toKey) => {
  if (fromKey === 'DRAFT' && (toKey === 'PENDING_APPROVAL' || toKey === 'CONFIRMED')) {
    return { type: 'submit', label: 'Submit for approval' };
  }
  if (['APPROVED', 'UNDER_NEGOTIATION'].includes(fromKey) && toKey === 'CONFIRMED') {
    return { type: 'confirm', label: 'Confirm quotation' };
  }
  if (['APPROVED', 'UNDER_NEGOTIATION'].includes(fromKey) && toKey === 'WITHDRAWN') {
    return { type: 'withdraw', label: 'Withdraw quotation' };
  }
  return null;
};

const INVALID_DROP_REASON = {
  PENDING_APPROVAL: 'This is waiting on a Sales Manager or Finance — act on it from the Approvals queue.',
  REJECTED: "A rejection is recorded by an approver, not moved here directly — see the quotation's own page to re-quote it.",
};

const QuotationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [view, setView] = useState('list');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(false);
  const [noteModal, setNoteModal] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null); // { row, request, step }
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setIsLoading(true);
    setError(false);
    listQuotations(status ? { status } : {})
      .then(setQuotations)
      .catch(() => {
        toast.error('Could not load quotations');
        setError(true);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [status]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return quotations;
    return quotations.filter((row) =>
      [row.code, row.customer?.name, row.owner?.name].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [quotations, debouncedSearch]);

  const canCreate = CAN_CREATE.includes(user.role);

  const canActOn = (row) =>
    CAN_CREATE.includes(user.role) && (user.role === 'SALES_MANAGER' || row.owner?.id === user.id);

  // The list endpoint only ever sends the currently-open request (if any),
  // trimmed to its ACTIVE step — see quotation.service.js's listQuotations.
  const getMyActiveStep = (row) => {
    const request = row.approvalRequests?.[0];
    const step = request?.steps?.find((s) => canActOnStep(s, user.role));
    return step ? { request, step } : null;
  };

  const runAction = async (row, label, fn) => {
    setBusyId(row.id);
    try {
      await fn();
      toast.success(label);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const approveFromBoard = () => {
    if (!approveTarget) return;
    const { row, request, step } = approveTarget;
    setApproveTarget(null);
    runAction(row, 'Step approved', () => actOnStep(request.id, step.id, { action: 'APPROVE' }));
  };

  const handleDrop = (row, fromKey, toKey) => {
    const action = dropAction(fromKey, toKey);
    if (!action) return;

    if (action.type === 'submit') {
      runAction(row, 'Quotation submitted', () => submitQuotation(row.id));
      return;
    }

    // Confirm/withdraw both accept an optional note — same UX as the
    // detail page's buttons, just reached by dragging instead of clicking.
    setNoteModal({
      title: action.label,
      run: (note) =>
        runAction(
          row,
          action.type === 'confirm' ? 'Quotation confirmed' : 'Quotation withdrawn',
          () =>
            action.type === 'confirm'
              ? confirmQuotation(row.id, note)
              : withdrawQuotation(row.id, note)
        ),
    });
  };

  const handleInvalidDrop = (row, fromKey, toKey) => {
    if (fromKey === toKey) return;
    toast.error(INVALID_DROP_REASON[toKey] ?? `A quotation can't move from ${fromKey} to ${toKey} directly.`);
  };

  const columns = [
    { key: 'code', header: 'Quotation', sortable: true, render: (row) => <span className="font-medium">{row.code}</span> },
    { key: 'customer', header: 'Customer', sortable: true, sortValue: (row) => row.customer?.name, render: (row) => row.customer.name },
    { key: 'owner', header: 'Owner', sortable: true, sortValue: (row) => row.owner?.name, render: (row) => row.owner.name },
    {
      key: 'total',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.totals?.grandTotal ?? 0,
      render: (row) => formatINR(row.totals?.grandTotal ?? 0),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} dot />,
    },
    {
      key: 'lastActivityAt',
      header: 'Last activity',
      sortable: true,
      render: (row) => new Date(row.lastActivityAt).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="Every quotation you can see, from draft to confirmed."
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New Quotation
            </Button>
          )
        }
      />

      <FilterBar options={FILTERS} value={status} onChange={setStatus}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by code, customer, or owner…"
        />
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView('list')}
            title="List view"
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
              view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <List className="size-3.5" aria-hidden="true" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView('kanban')}
            title="Kanban view"
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
              view === 'kanban' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Kanban
          </button>
        </div>
      </FilterBar>

      {isCreating && (
        <QuotationFormModal
          onClose={() => setIsCreating(false)}
          onCreated={(quotation) => {
            setIsCreating(false);
            navigate(`/workspace/quotations/${quotation.id}`);
          }}
        />
      )}

      {noteModal && (
        <NoteModal
          title={noteModal.title}
          onClose={() => setNoteModal(null)}
          onSubmit={async (note) => {
            setNoteModal(null);
            await noteModal.run(note);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(approveTarget)}
        title="Approve this quotation step?"
        message={
          approveTarget &&
          `You are approving as ${approveTarget.step.role === 'SALES_MANAGER' ? 'Sales Manager' : 'Finance'} for ${approveTarget.row.code}. Once every required step is approved, the quotation advances to Approved. A rejection or return still needs a reason, so those stay on the quotation's own page.`
        }
        confirmLabel="Approve Step"
        tone="success"
        isLoading={busyId === approveTarget?.row.id}
        onConfirm={approveFromBoard}
        onClose={() => setApproveTarget(null)}
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load quotations. Please try again in a moment.
        </div>
      ) : isLoading ? (
        view === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white">
            <SkeletonTable rows={6} cols={6} />
          </div>
        )
      ) : view === 'kanban' ? (
        <KanbanBoard
          columns={KANBAN_COLUMN_KEYS.map((key) => ({
            key,
            label: FILTERS.find((f) => f.value === key)?.label ?? key,
            tone: resolveStatus(key).tone,
            headerAction: key === 'DRAFT' && canCreate && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                title="New quotation"
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            ),
          }))}
          rows={filtered}
          getColumnKey={(row) => row.status}
          getCardAccentClassName={(row) => TONE_BORDER[resolveStatus(row.status).tone]}
          onCardClick={(row) => navigate(`/workspace/quotations/${row.id}`)}
          canDrag={(row) => !busyId && canActOn(row) && ['DRAFT', 'APPROVED', 'UNDER_NEGOTIATION'].includes(row.status)}
          canDrop={(row, fromKey, toKey) => ({ allowed: Boolean(dropAction(fromKey, toKey)) })}
          onDrop={handleDrop}
          onInvalidDrop={handleInvalidDrop}
          renderColumnSummary={(items) => (
            <span className="tabular-nums">
              {formatINR(items.reduce((sum, row) => sum + (row.totals?.grandTotal ?? 0), 0))} total
            </span>
          )}
          renderCard={(row) => {
            const myStep = getMyActiveStep(row);
            return (
              <div className={cn(busyId === row.id && 'opacity-50')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{row.code}</span>
                  <span className="text-xs font-medium tabular-nums text-slate-500">
                    {formatINR(row.totals?.grandTotal ?? 0)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{row.customer?.name}</p>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5" title={row.owner?.name}>
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                        avatarClass(row.owner?.name)
                      )}
                    >
                      {initials(row.owner?.name)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(row.lastActivityAt).toLocaleDateString()}
                    </span>
                  </div>

                  {myStep && (
                    <button
                      type="button"
                      title="Approve this step"
                      onClick={(event) => {
                        event.stopPropagation();
                        setApproveTarget({ row, ...myStep });
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      draggable={false}
                      className="flex cursor-pointer items-center gap-1 rounded-md bg-green-50 px-1.5 py-1 text-[11px] font-medium text-green-700 transition-colors hover:bg-green-100"
                    >
                      <Check className="size-3" aria-hidden="true" />
                      Approve
                    </button>
                  )}
                </div>
              </div>
            );
          }}
          emptyIcon={FileText}
          emptyTitle={status || search ? 'No quotations match this view' : 'No quotations yet'}
          emptyDescription="Try a different status filter, or clear your search."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          defaultSort={{ key: 'lastActivityAt', direction: 'desc' }}
          onRowClick={(row) => navigate(`/workspace/quotations/${row.id}`)}
          emptyIcon={FileText}
          emptyTitle={status || search ? 'No quotations match this filter' : 'No quotations yet'}
          emptyDescription={
            status || search
              ? 'Try a different status or search term, or clear the filters to see everything.'
              : 'Quotations you create or that are shared with you will show up here.'
          }
          emptyAction={
            !status &&
            !search &&
            canCreate && (
              <Button size="sm" onClick={() => setIsCreating(true)}>
                <Plus className="size-4" aria-hidden="true" />
                New Quotation
              </Button>
            )
          }
        />
      )}
    </div>
  );
};

export default QuotationsPage;
