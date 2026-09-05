import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import { submitQuoteRequest } from '../api/quoteRequests';
import Button from '../components/Button';
import Input from '../components/Input';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import Textarea from '../components/Textarea';
import { useCart } from '../hooks/useCart';
import { CATEGORY_ICONS } from '../data/catalog';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { formatPrice } from '../lib/currency';

const EMPTY_FORM = { name: '', company: '', email: '', phone: '', message: '' };

/*
 * Submits to a real lead-capture endpoint that reaches Netrix's sales team —
 * see docs/SOURCE_OF_TRUTH.md §2.11 (QuoteRequest). This is deliberately not
 * a Quotation: the submitter has no account yet, and a rep reviews the lead
 * before any real sales record is created.
 *
 * Items arrive two ways: a one-off "just this item" pick from a product card
 * (via route state, independent of the persistent cart) or the accumulated
 * quote cart reviewed on /cart. Either can also be empty — a general enquiry
 * from About/Landing with no specific items attached.
 */
const RequestQuote = () => {
  useBrandTag(`Request a Quote · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);
  const location = useLocation();
  const cart = useCart();

  const fromCart = !location.state?.items;
  const items = location.state?.items ?? cart.items;

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      await submitQuoteRequest({
        ...form,
        items: items.map((i) => ({ productName: i.name, quantity: i.quantity })),
      });
      if (fromCart) cart.clearCart();
      setSubmitted(true);
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length) {
        setFieldErrors(
          Object.fromEntries(apiErrors.map((e) => [e.field, e.message]))
        );
      }
      setFormError(
        err.response?.data?.message ??
          'Could not send your request right now — please try again shortly.'
      );
    } finally {
      setSubmitting(false);
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
              Request received
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Thanks, {form.name.split(' ')[0] || 'there'} — someone from our
              sales team will reach out to schedule a site survey shortly.
            </p>
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
                    <Link
                      to="/cart"
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Edit cart
                    </Link>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const Icon = CATEGORY_ICONS[item.category];
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              <Textarea
                label={
                  items.length > 0
                    ? 'Anything else we should know? (optional)'
                    : 'What do you need secured?'
                }
                rows={4}
                required={items.length === 0}
                placeholder="e.g. CCTV coverage for a 3-floor office, plus biometric attendance for ~150 staff"
                value={form.message}
                onChange={update('message')}
                error={fieldErrors.message}
              />

              {formError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Request'}
              </Button>
            </form>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default RequestQuote;
