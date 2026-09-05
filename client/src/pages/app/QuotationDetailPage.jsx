import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { actOnStep } from '../../api/approvals';
import { confirmQuotation, getQuotation, submitQuotation, withdrawQuotation } from '../../api/quotations';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import DetailSection from '../../components/DetailSection';
import EditQuotationLinesModal from '../../components/EditQuotationLinesModal';
import Logo from '../../components/Logo';
import NoteModal from '../../components/NoteModal';
import PageHeader from '../../components/PageHeader';
import QuotationFormModal from '../../components/QuotationFormModal';
import StatusBadge from '../../components/StatusBadge';
import StepProgress from '../../components/StepProgress';
import { useAuth } from '../../hooks/useAuth';
import { formatINR } from '../../lib/currency';

const CAN_ACT_ON_QUOTATION = ['SALES_REP', 'SALES_MANAGER'];

// Matches the backend's LINES_EDITABLE_STATUSES exactly (quotation.service.js)
// — DRAFT is a rep still shaping it, UNDER_NEGOTIATION is applying a
// customer's counter. Editing in UNDER_NEGOTIATION re-evaluates and
// re-routes on save (§4); everything else (mid-approval, terminal states)
// is not something a line edit here can touch.
const LINES_EDITABLE_STATUSES = ['DRAFT', 'UNDER_NEGOTIATION'];

const STEP_STATUS_MAP = {
  PENDING: 'pending',
  ACTIVE: 'active',
  APPROVED: 'done',
  REJECTED: 'rejected',
  RETURNED: 'returned',
};

const REQUEST_STATUS_LABEL = {
  PENDING: 'STEP_ACTIVE', // reuses lib/status.js's "In Review" label/tone
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
};

const ROLE_LABEL = { SALES_MANAGER: 'Sales Manager', FINANCE: 'Finance' };

const QuotationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [noteModal, setNoteModal] = useState(null); // { title, required, run(note) }
  const [isRequoting, setIsRequoting] = useState(false);
  const [isEditingLines, setIsEditingLines] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const load = () => {
    getQuotation(id)
      .then((data) => {
        setQuotation(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  };

  // load is also called from runAction (to refresh after submit/act), so it
  // can't be defined inside the effect — but it only closes over `id`, which
  // is already the dependency below, so it's safe to omit.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runAction = async (label, fn) => {
    setIsBusy(true);
    try {
      await fn();
      toast.success(label);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Action failed');
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) return <Logo className="mx-auto mt-20 animate-pulse" />;
  if (error || !quotation) {
    return (
      <div>
        <PageHeader title="Quotation not found" />
        <Link to="/workspace/quotations" className="text-sm text-brand-600 hover:underline">
          Back to quotations
        </Link>
      </div>
    );
  }

  const isOwnerOrManager =
    CAN_ACT_ON_QUOTATION.includes(user.role) &&
    (user.role === 'SALES_MANAGER' || quotation.owner.id === user.id);

  const activeApprovalRequest = quotation.approvalRequests?.find((r) => r.status === 'PENDING');
  const myActiveStep = activeApprovalRequest?.steps.find(
    (step) => step.status === 'ACTIVE' && (step.role === user.role || user.role === 'ADMIN')
  );

  const lineColumns = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.product?.name ?? `#${row.productId}`}</p>
          <p className="text-xs text-slate-400">{row.product?.sku}</p>
        </div>
      ),
    },
    { key: 'quantity', header: 'Qty', align: 'right' },
    { key: 'unitPrice', header: 'Unit price', align: 'right', render: (row) => formatINR(row.unitPrice) },
    {
      key: 'discountPercent',
      header: 'Discount',
      align: 'right',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {row.discountPercent}%
          <StatusBadge status={row.discountPercent > row.ceilingAtEntry ? 'OVER' : 'OK'} />
        </span>
      ),
    },
    { key: 'ceiling', header: 'Ceiling', align: 'right', render: (row) => `${row.ceilingAtEntry}%` },
    { key: 'tax', header: 'GST', align: 'right', render: (row) => `${row.taxRateAtEntry}%` },
    {
      key: 'recurring',
      header: 'Billing',
      render: (row) => (row.isRecurring ? row.recurringCycle : 'One-time'),
    },
  ];

  const runNoteAction = (title, required, action) =>
    setNoteModal({
      title,
      required,
      run: async (note) => {
        setNoteModal(null);
        await runAction(title, () => action(note));
      },
    });

  return (
    <div>
      <Link
        to="/workspace/quotations"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to quotations
      </Link>

      <PageHeader
        title={quotation.code}
        subtitle={`${quotation.customer.name} · owned by ${quotation.owner.name}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={quotation.status} dot />

            {quotation.chatConversation && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigate(`/workspace/chat?conversationId=${quotation.chatConversation.id}`)
                }
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                {quotation.chatConversation.status === 'PENDING' ? 'Chat waiting' : 'View chat'}
              </Button>
            )}

            {quotation.status === 'DRAFT' && isOwnerOrManager && (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => runAction('Quotation submitted', () => submitQuotation(quotation.id))}
              >
                Submit for Approval
              </Button>
            )}

            {['APPROVED', 'UNDER_NEGOTIATION'].includes(quotation.status) && isOwnerOrManager && (
              <>
                <Button
                  size="sm"
                  variant="success"
                  disabled={isBusy}
                  onClick={() =>
                    runNoteAction('Quotation confirmed', false, (note) => confirmQuotation(quotation.id, note))
                  }
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={isBusy}
                  onClick={() =>
                    runNoteAction('Quotation withdrawn', false, (note) => withdrawQuotation(quotation.id, note))
                  }
                >
                  Withdraw
                </Button>
              </>
            )}

            {['REJECTED', 'WITHDRAWN'].includes(quotation.status) && isOwnerOrManager && (
              <Button size="sm" onClick={() => setIsRequoting(true)}>
                Create New Quotation
              </Button>
            )}
          </div>
        }
      />

      {(quotation.previousQuotationId || quotation.supersededByQuotationId) && (
        <p className="-mt-3 mb-5 text-sm text-slate-500">
          {quotation.previousQuotationId && (
            <>
              Requoted from{' '}
              <Link
                to={`/workspace/quotations/${quotation.previousQuotationId}`}
                className="text-brand-600 hover:underline"
              >
                Q-{1000 + quotation.previousQuotationId}
              </Link>
              .{' '}
            </>
          )}
          {quotation.supersededByQuotationId && (
            <>
              Superseded by{' '}
              <Link
                to={`/workspace/quotations/${quotation.supersededByQuotationId}`}
                className="text-brand-600 hover:underline"
              >
                Q-{1000 + quotation.supersededByQuotationId}
              </Link>
              .
            </>
          )}
        </p>
      )}

      {isRequoting && (
        <QuotationFormModal
          source={quotation}
          onClose={() => setIsRequoting(false)}
          onCreated={(created) => {
            setIsRequoting(false);
            navigate(`/workspace/quotations/${created.id}`);
          }}
        />
      )}

      {noteModal && (
        <NoteModal
          title={noteModal.title}
          required={noteModal.required}
          onClose={() => setNoteModal(null)}
          onSubmit={noteModal.run}
        />
      )}

      {isEditingLines && (
        <EditQuotationLinesModal
          quotation={quotation}
          onClose={() => setIsEditingLines(false)}
          onUpdated={(updated) => {
            setIsEditingLines(false);
            setQuotation(updated);
          }}
        />
      )}

      <div className="space-y-4">
        <DetailSection
          title="Lines"
          padded={false}
          actions={
            LINES_EDITABLE_STATUSES.includes(quotation.status) &&
            isOwnerOrManager && (
              <Button size="sm" variant="secondary" onClick={() => setIsEditingLines(true)}>
                Edit Lines
              </Button>
            )
          }
        >
          <DataTable columns={lineColumns} rows={quotation.lines} />
          {quotation.totals && (
            <div className="flex justify-end gap-6 border-t border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">
                Subtotal <span className="ml-1.5 font-medium text-slate-900">{formatINR(quotation.totals.netTotal)}</span>
              </span>
              <span className="text-slate-500">
                GST <span className="ml-1.5 font-medium text-slate-900">{formatINR(quotation.totals.taxTotal)}</span>
              </span>
              <span className="text-slate-500">
                Total <span className="ml-1.5 font-semibold text-slate-900">{formatINR(quotation.totals.grandTotal)}</span>
              </span>
            </div>
          )}
        </DetailSection>

        {quotation.approvalRequests?.length > 0 && (
          <DetailSection
            title="Approval"
            description={`${quotation.approvalRequests.length} round(s) — a new round opens every time a breaching version is resubmitted.`}
          >
            <div className="space-y-6">
              {quotation.approvalRequests.map((request) => (
                <div key={request.id}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Terms v{request.termsVersion} · {request.approvalLevel === 'MANAGER_FINANCE' ? 'Manager + Finance' : 'Manager only'}
                    </span>
                    <StatusBadge status={REQUEST_STATUS_LABEL[request.status]} />
                  </div>

                  <StepProgress
                    steps={request.steps.map((step) => ({
                      label: ROLE_LABEL[step.role] ?? step.role,
                      status: STEP_STATUS_MAP[step.status] ?? 'pending',
                      meta: step.actedBy
                        ? `${step.actedBy.name}${step.note ? ` — "${step.note}"` : ''}`
                        : undefined,
                    }))}
                  />

                  {request.id === activeApprovalRequest?.id && myActiveStep && (
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={isBusy}
                        onClick={() => {
                          if (!window.confirm('Approve this step?')) return;
                          runAction('Step approved', () => actOnStep(request.id, myActiveStep.id, { action: 'APPROVE' }));
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="warning"
                        disabled={isBusy}
                        onClick={() =>
                          runNoteAction('Step returned for rework', true, (note) =>
                            actOnStep(request.id, myActiveStep.id, { action: 'RETURN', note })
                          )
                        }
                      >
                        Return for Rework
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isBusy}
                        onClick={() =>
                          runNoteAction('Step rejected', true, (note) =>
                            actOnStep(request.id, myActiveStep.id, { action: 'REJECT', note })
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="Activity" description="Every approval, rejection, edit and decision — user, timestamp, reason.">
          <ol className="space-y-3">
            {quotation.auditLog?.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-300" />
                <div>
                  <p className="text-slate-900">
                    <span className="font-medium">{entry.action.replaceAll('_', ' ')}</span>
                    {entry.user && <span className="text-slate-500"> · {entry.user.name}</span>}
                  </p>
                  {entry.note && <p className="text-slate-500">{entry.note}</p>}
                  <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ol>
        </DetailSection>
      </div>
    </div>
  );
};

export default QuotationDetailPage;
