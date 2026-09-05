import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ProductSuggestions from '../components/ProductSuggestions';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { useCart } from '../hooks/useCart';
import { CATEGORY_ICONS } from '../data/catalog';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';
import { toCartItem } from '../lib/cartItem';
import { formatINR, formatPrice } from '../lib/currency';

const CYCLE_LABEL = { month: 'Monthly total', quarter: 'Quarterly total', year: 'Yearly total' };

const Cart = () => {
  useBrandTag(`Your Quote Cart · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);
  const navigate = useNavigate();
  const { items, addItem, updateQuantity, removeItem, clearCart } = useCart();

  const totals = items.reduce((acc, item) => {
    const key = item.cycle ?? 'oneTime';
    acc[key] = (acc[key] ?? 0) + item.price * item.quantity;
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Your Quote Cart
        </h1>

        {items.length === 0 ? (
          <div className="mt-10 rounded-lg border border-slate-200">
            <EmptyState
              icon={ShoppingCart}
              title="Your quote cart is empty"
              description="Browse our products and services and add anything you'd like priced."
              action={
                <Link to="/products">
                  <Button variant="secondary">Browse Products & Services</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-8 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {items.map((item) => {
                // Same fallback as ProductCard: item.category is now a real
                // category name from the live catalog API, which won't match
                // this static presentation map for most categories.
                const Icon = CATEGORY_ICONS[item.category] || Package;
                return (
                  <div key={item.id} className="flex items-center gap-4 p-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-slate-100">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-full rounded-md object-contain"
                        />
                      ) : (
                        <Icon className="size-6 text-slate-400" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatPrice(item)} each
                      </p>
                    </div>

                    <div className="flex items-center rounded-md border border-slate-300">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex size-8 items-center justify-center text-slate-500 hover:text-slate-900"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span className="w-7 text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex size-8 items-center justify-center text-slate-500 hover:text-slate-900"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <p className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-slate-900">
                      {formatINR(item.price * item.quantity)}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <ProductSuggestions
              productIds={items.map((item) => item.id)}
              className="mt-10"
              onAdd={(suggested) => {
                addItem(toCartItem(suggested), 1);
                toast.success(`Added ${suggested.name} to your quote cart`);
              }}
            />

            <div className="mt-6 flex items-start justify-between gap-6">
              <button
                type="button"
                onClick={clearCart}
                className="text-sm text-slate-400 hover:text-red-600"
              >
                Clear cart
              </button>

              <div className="w-56 space-y-1.5 text-right text-sm">
                {totals.oneTime > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">One-time total</span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatINR(totals.oneTime)}
                    </span>
                  </div>
                )}
                {['month', 'quarter', 'year'].map(
                  (cycle) =>
                    totals[cycle] > 0 && (
                      <div key={cycle} className="flex justify-between">
                        <span className="text-slate-500">
                          {CYCLE_LABEL[cycle]}
                        </span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {formatINR(totals[cycle])}
                        </span>
                      </div>
                    )
                )}
              </div>
            </div>

            <p className="mt-2 text-right text-xs text-slate-400">
              Indicative only — your itemized quotation is confirmed after a
              site survey.
            </p>

            <div className="mt-8 flex justify-end">
              <Button size="lg" onClick={() => navigate('/request-quote')}>
                Continue to Request a Quote
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Cart;
