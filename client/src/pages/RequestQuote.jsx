import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Package, Trash2 } from 'lucide-react';

import { listMyChatMessages, startChat } from '../api/chat';
import { getPortalToken, registerAndRequestQuote, registerCustomer, requestQuoteAsCustomer } from '../api/portal';
import Button from '../components/Button';
import ChatPanel from '../components/ChatPanel';
import Input from '../components/Input';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import Textarea from '../components/Textarea';
import { useCart } from '../hooks/useCart';
import { usePortalAuth } from '../hooks/usePortalAuth';
import { CATEGORY_ICONS } from '../data/catalog';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { formatPrice } from '../lib/currency';

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  password: '',
  message: '',
  address: '',
  pincode: '',
  state: '',
  country: '',
};

/*
 * Creates an account AND a real quotation in one submission. The server does
 * both inside one transaction (POST /api/portal/quote-requests), so a failure
 * anywhere leaves nothing behind — no half-registered customer holding an
 * email address they cannot retry with.
 *
 * The customer is signed in on success (a portal-audience token, stored
 * separately from any staff session) and can track the quotation from there.
 *
 * Items arrive two ways: a one-off "just this item" pick from a product card
 * (via route state, independent of the persistent cart) or the accumulated
 * quote cart reviewed on /cart. A password is only meaningful alongside
 * items, so a general enquiry with an empty cart is blocked before submit.
 */
const RequestQuote = () => {
  useBrandTag(`Request a Quote · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);
  const location = useLocation();
  const cart = useCart();

  const fromCart = !location.state?.items;
  const items = location.state?.items ?? cart.items;
  const loginLinkState = { from: '/request-quote', items: fromCart ? undefined : items };

  // Arrives here after a login attempt for an email with no account — skip
  // the Log In / Create Account choice and drop them straight into signup.
  const emailFromLogin = location.state?.email;

  const [form, setForm] = useState(() =>
    emailFromLogin ? { ...EMPTY_FORM, email: emailFromLogin } : EMPTY_FORM
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [chat, setChat] = useState(null); // { id, status }
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [noOneAvailable, setNoOneAvailable] = useState(false);
  const [chatError, setChatError] = useState('');

  // Shared across the site (see SiteHeader) so a login elsewhere is already
  // reflected here, and vice versa.
  const { customer, isLoading: checkingSession, logout, setCustomer } = usePortalAuth();

  // A guest is asked to choose before any fields appear — 'choice' shows the
  // Log In / Create account buttons, 'signup' reveals the account form.
  const [mode, setMode] = useState(emailFromLogin ? 'signup' : 'choice');

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const hasItems = items.length > 0;

    // A signed-in customer needs items to request a quote — caught here
    // rather than server-side so the message points at the cart instead of
    // reading as a validation failure. A guest with an empty cart is just
    // creating an account, which needs no items at all.
    if (customer && !hasItems) {
      setFormError('Add at least one product to your cart before requesting a quote.');
      return;
    }

    setSubmitting(true);

    try {
      const lines = items.map((i) => ({
        productId: i.id,
        quantity: i.quantity,
        isRecurring: i.isRecurring ?? false,
        recurringCycle: i.isRecurring ? i.recurringCycle : undefined,
      }));

      let result;
      if (customer) {
        result = {
          customer,
          quotation: await requestQuoteAsCustomer({ message: form.message || undefined, lines }),
        };
      } else if (hasItems) {
        result = await registerAndRequestQuote({
          name: form.name,
          company: form.company,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          message: form.message || undefined,
          address: form.address || undefined,
          pincode: form.pincode || undefined,
          state: form.state || undefined,
          country: form.country || undefined,
          lines,
        });
      } else {
        result = await registerCustomer({
          name: form.name,
          company: form.company,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          address: form.address || undefined,
          pincode: form.pincode || undefined,
          state: form.state || undefined,
          country: form.country || undefined,
        });
      }
      if (!customer) setCustomer(result.customer);
      if (fromCart) cart.clearCart();
      setSubmitted(result);
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length) {
        setFieldErrors(
          Object.fromEntries(apiErrors.map((e) => [e.field, e.message]))
        );
        // Some failing fields (e.g. "lines", the cart) have no matching input
        // to show an inline error under, so the real reason must go in the
        // banner too — otherwise a rejection for a field the form doesn't
        // render reads as an unexplained "Validation failed".
        setFormError(apiErrors.map((e) => e.message).join(' '));
      } else {
        setFormError(
          err.response?.data?.message ??
            'Could not send your request right now — please try again shortly.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openChat = async () => {
    if (!submitted?.quotation) return;
    setIsStartingChat(true);
    setChatError('');
    try {
      const { conversation, noOneAvailable: none } = await startChat(submitted.quotation.id);
      setChat(conversation);
      setNoOneAvailable(none);
    } catch {
      setChatError('Could not start the chat right now — please try again shortly.');
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        {submitted ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <CheckCircle2
              className="mx-auto size-10 text-green-600"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              {submitted.quotation ? `Quotation ${submitted.quotation.code} created` : 'Account created'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Thanks,{' '}
              {(submitted.customer.contactName || form.name).split(' ')[0] || 'there'}
              {' — '}
              {submitted.quotation
                ? customer
                  ? 'your quotation is with our sales team. They’ll be in touch to schedule a site survey.'
                  : 'your account is set up and your quotation is with our sales team. They’ll be in touch to schedule a site survey.'
                : 'your account is set up. Browse our products and request a quote whenever you’re ready.'}
            </p>

            {submitted.quotation && (
              <dl className="mt-6 divide-y divide-slate-100 rounded-md border border-slate-200 text-left text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-slate-500">Reference</dt>
                  <dd className="font-medium text-slate-900">
                    {submitted.quotation.code}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-slate-500">Items</dt>
                  <dd className="tabular-nums text-slate-900">
                    {submitted.quotation.lines.length}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-slate-500">Indicative total</dt>
                  <dd className="tabular-nums font-medium text-slate-900">
                    ₹{submitted.quotation.total.toLocaleString('en-IN')}
                  </dd>
                </div>
              </dl>
            )}

            <p className="mt-4 text-xs text-slate-500">
              Signed in as {submitted.customer.email}.
              {submitted.quotation && ' Final pricing is confirmed after a site survey.'}
            </p>

            {submitted.quotation && !chat && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-5"
                disabled={isStartingChat}
                onClick={openChat}
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Chat with our sales team
              </Button>
            )}

            {chatError && <p className="mt-3 text-sm text-red-600">{chatError}</p>}

            {chat && noOneAvailable && chat.status === 'PENDING' && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                No one is available right now — send a message and we'll get back to you.
              </p>
            )}

            {chat && (
              <div className="fixed bottom-6 right-6 z-50 text-left">
                <ChatPanel
                  conversationId={chat.id}
                  audience="portal"
                  token={getPortalToken()}
                  fetchHistory={listMyChatMessages}
                  isMine={(message) => message.senderType === 'CUSTOMER'}
                  onAssigned={() => {
                    setChat((prev) => ({ ...prev, status: 'ACTIVE' }));
                    setNoOneAvailable(false);
                  }}
                  onClose={() => setChat(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Request a Quote
            </h1>
            <p className="mt-2 text-slate-600">
              Tell us what needs securing and we&apos;ll get back to you to
              schedule a site survey.
            </p>

            {items.length > 0 && (
              <div className="mt-6 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Items in this request
                  </p>
                  {fromCart && (
                    <div className="flex items-center gap-3">
                      <Link
                        to="/cart"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Edit cart
                      </Link>
                      <button
                        type="button"
                        onClick={cart.clearCart}
                        className="text-xs font-medium text-slate-400 hover:text-red-600"
                      >
                        Clear cart
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((item) => {
                    // Same fallback as ProductCard/Cart: item.category is a
                    // real category name from the live catalog API.
                    const Icon = CATEGORY_ICONS[item.category] || Package;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3 text-sm"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                          <Icon className="size-4 text-slate-400" aria-hidden="true" />
                        </span>
                        <span className="flex-1 text-slate-700">
                          {item.name}
                          <span className="ml-1.5 text-slate-400">
                            × {item.quantity}
                          </span>
                        </span>
                        <span className="tabular-nums text-slate-500">
                          {formatPrice(item)}
                        </span>
                        {fromCart && (
                          <button
                            type="button"
                            onClick={() => cart.removeItem(item.id)}
                            className="shrink-0 text-slate-400 hover:text-red-600"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {checkingSession ? (
              <p className="mt-6 text-sm text-slate-500">Checking your session…</p>
            ) : !customer && mode === 'choice' ? (
              <div className="mt-6 rounded-lg border border-slate-200 p-6 text-center">
                <p className="text-sm text-slate-600">
                  Sign in to send this request, or create an account if you&apos;re
                  new here.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link to="/portal/login" state={loginLinkState}>
                    <Button variant="secondary" className="w-full sm:w-auto">
                      Log In
                    </Button>
                  </Link>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => setMode('signup')}
                  >
                    Create Account &amp; Get Quote
                  </Button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {customer ? (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <span className="text-slate-600">
                    Signed in as{' '}
                    <span className="font-medium text-slate-900">{customer.email}</span>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Not you?
                  </button>
                </div>
              ) : (
                <>
                  {emailFromLogin ? (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      We couldn&apos;t find an account for {emailFromLogin}. Create one below.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMode('choice')}
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                      ‹ Back
                    </button>
                  )}
                  <Input
                    label="Your name"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={update('name')}
                    error={fieldErrors.name}
                  />
                  <Input
                    label="Company"
                    autoComplete="organization"
                    required
                    value={form.company}
                    onChange={update('company')}
                    error={fieldErrors.company}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={update('email')}
                      error={fieldErrors.email}
                    />
                    <Input
                      label="Phone (optional)"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={update('phone')}
                      error={fieldErrors.phone}
                    />
                  </div>
                  <Input
                    label="Create a password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    hint="At least 8 characters — you'll use this to track your quotation."
                    value={form.password}
                    onChange={update('password')}
                    error={fieldErrors.password}
                  />
                  <Input
                    label="Address"
                    autoComplete="street-address"
                    value={form.address}
                    onChange={update('address')}
                    error={fieldErrors.address}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input
                      label="Pincode"
                      autoComplete="postal-code"
                      value={form.pincode}
                      onChange={update('pincode')}
                      error={fieldErrors.pincode}
                    />
                    <Input
                      label="State"
                      autoComplete="address-level1"
                      value={form.state}
                      onChange={update('state')}
                      error={fieldErrors.state}
                    />
                    <Input
                      label="Country"
                      autoComplete="country-name"
                      value={form.country}
                      onChange={update('country')}
                      error={fieldErrors.country}
                    />
                  </div>
                </>
              )}
              {items.length > 0 && (
                <Textarea
                  label="Anything else we should know? (optional)"
                  rows={4}
                  placeholder="e.g. CCTV coverage for a 3-floor office, plus biometric attendance for ~150 staff"
                  value={form.message}
                  onChange={update('message')}
                  error={fieldErrors.message}
                />
              )}

              {formError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Request'}
              </Button>
            </form>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default RequestQuote;
