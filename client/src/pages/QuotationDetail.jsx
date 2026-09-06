import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FileX, MessageCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { listMyChatMessages, startChat } from '../api/chat';
import { getMyQuotation, getPortalToken } from '../api/portal';
import Button from '../components/Button';
import ChatPanel from '../components/ChatPanel';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import StatusBadge from '../components/StatusBadge';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Field = ({ label, children }) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-1.5 text-base text-slate-900">{children}</div>
  </div>
);

const QuotationDetail = () => {
  const { id } = useParams();
  useBrandTag(`Quotation · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  const [quotation, setQuotation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [chat, setChat] = useState(null); // { id, status }
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [noOneAvailable, setNoOneAvailable] = useState(false);

  const load = () => {
    setIsLoading(true);
    setHasError(false);
    getMyQuotation(id)
      .then(setQuotation)
      .catch(() => {
        setHasError(true);
        toast.error('Could not load this quotation');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openChat = async () => {
    setIsStartingChat(true);
    try {
      const { conversation, noOneAvailable: none } = await startChat(id);
      setChat(conversation);
      setNoOneAvailable(none);
    } catch {
      toast.error('Could not start the chat');
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Link
          to="/portal/quotations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          My Quotations
        </Link>

        {isLoading ? (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="rounded-lg border border-slate-200 p-6">
              <SkeletonText lines={4} />
            </div>
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : hasError ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-14 text-center">
            <AlertCircle className="size-8 text-red-500" aria-hidden="true" />
            <p className="text-base font-semibold text-red-700">Couldn&apos;t load this quotation</p>
            <p className="max-w-sm text-sm leading-relaxed text-red-600">
              Something went wrong on our end. Please try again in a moment.
            </p>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : !quotation ? (
          <div className="mt-10 rounded-lg border border-slate-200">
            <EmptyState
              icon={FileX}
              title="Quotation not found"
              description="This quotation may have been removed, or the link is incorrect."
              action={
                <Link to="/portal/quotations">
                  <Button variant="secondary">Back to My Quotations</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="mt-6 flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {quotation.code}
              </h1>
              <StatusBadge status={quotation.status} dot />

              {!chat && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  disabled={isStartingChat}
                  onClick={openChat}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Chat with our sales team
                </Button>
              )}
            </div>

            {chat && noOneAvailable && chat.status === 'PENDING' && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                No one is available right now — send a message and we'll get back to you.
              </p>
            )}

            {chat && (
              <div className="fixed bottom-6 right-6 z-50">
                <ChatPanel
                  conversationId={chat.id}
                  audience="portal"
                  token={getPortalToken()}
                  fetchHistory={listMyChatMessages}
                  isMine={(message) => message.senderType === 'CUSTOMER'}
                  onAssigned={() => {
                    setChat((prev) => ({ ...prev, status: 'ACTIVE' }));
                    setNoOneAvailable(false);
                    toast.success('A sales rep has joined the chat');
                  }}
                  onClose={() => setChat(null)}
                />
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-6 rounded-lg border border-slate-200 p-6 sm:grid-cols-2">
              <Field label="Date">{formatDate(quotation.createdAt)}</Field>
              <Field label="Reference">{quotation.customerReference || '—'}</Field>
              <Field label="Notes">
                <span className="whitespace-pre-wrap">{quotation.notes || '—'}</span>
              </Field>
              <Field label="Total">₹{quotation.total.toLocaleString('en-IN')}</Field>
            </div>

            <h2 className="mt-10 text-lg font-semibold text-slate-900">Order lines</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotation.lines.map((line) => (
                    <tr key={line.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3.5 text-base text-slate-900">{line.product.name}</td>
                      <td className="px-4 py-3.5 text-slate-500">{line.product.sku}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        ₹{line.unitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {line.discountPercent ? `${line.discountPercent}%` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-base font-medium tabular-nums text-slate-900">
                        ₹{line.lineTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default QuotationDetail;
