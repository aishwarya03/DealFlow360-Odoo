import { ArrowUpRight, Minus, Package, Plus, ShoppingCart } from 'lucide-react';

import Button from './Button';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../data/catalog';
import { useCart } from '../hooks/useCart';
import { cn } from '../lib/cn';
import { formatPrice } from '../lib/currency';

/*
 * Quantity is read directly from the cart, not held as local state — this is
 * what lets a visitor see and adjust how much of a product they've already
 * added without leaving the Products page. Nothing is visible until the
 * first "Add to Quote": the counter has no meaning at zero, so it doesn't
 * render at zero, it crossfades in once it does.
 */
const ProductCard = ({ product, onAdd, onRequestQuote }) => {
  const { items, updateQuantity } = useCart();
  const cartQuantity = items.find((i) => i.id === product.id)?.quantity ?? 0;
  const inCart = cartQuantity > 0;
  const Icon = CATEGORY_ICONS[product.category] || Package;
  const imageUrl = product.imageUrl?.startsWith('http')
    ? product.imageUrl
    : product.imageUrl
      ? `${import.meta.env.VITE_API_URL}${product.imageUrl}`
      : null;

  const categoryName = product.category?.path ?? product.category?.name ?? product.productType;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60">
      <div className="relative flex aspect-[1.25/1] shrink-0 items-center justify-center overflow-hidden bg-slate-100 p-5">
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase shadow-sm">
          {product.productType === 'SERVICE' ? 'Service' : 'In stock'}
        </span>
        <button
          type="button"
          onClick={() => onRequestQuote(product, inCart ? cartQuantity : 1)}
          className="absolute top-3 right-3 flex size-8 translate-y-1 items-center justify-center rounded-full bg-white text-slate-500 opacity-0 shadow-sm transition group-hover:translate-y-0 group-hover:opacity-100 hover:text-brand-600"
          aria-label={`Request a quote for ${product.name}`}
        >
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </button>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="size-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-105"
          />
        ) : (
          <Icon className="size-14 text-slate-300 transition duration-500 group-hover:scale-110 group-hover:text-brand-300" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold tracking-[0.14em] text-brand-600 uppercase">
          {CATEGORY_LABELS[product.category] ?? categoryName}
        </p>
        <h3 className="mt-2 min-h-10 text-[17px] font-semibold leading-6 text-slate-900">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-500">
          {product.description || 'Configured for your team and ready to quote.'}
        </p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-bold tabular-nums text-slate-950">
              {formatPrice(product)}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Indicative price</p>
          </div>
          {product.isSubscribable && (
            <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">Flexible plan</span>
          )}
        </div>

      <div className="relative mt-5 h-10">
        <div
          className={cn(
            'absolute inset-0 transition-all duration-200 ease-out',
            inCart
              ? 'pointer-events-none scale-95 opacity-0'
              : 'scale-100 opacity-100'
          )}
        >
          <Button size="sm" className="w-full" onClick={() => onAdd(product)}>
            <ShoppingCart className="size-3.5" aria-hidden="true" />
            Add to Quote
          </Button>
        </div>

        <div
          className={cn(
            'absolute inset-0 flex items-center justify-between rounded-md border border-slate-300 transition-all duration-200 ease-out',
            inCart
              ? 'scale-100 opacity-100'
              : 'pointer-events-none scale-95 opacity-0'
          )}
        >
          <button
            type="button"
            onClick={() => updateQuantity(product.id, cartQuantity - 1)}
            className="flex h-full flex-1 items-center justify-center text-slate-500 hover:text-red-600"
            aria-label={
              cartQuantity === 1
                ? 'Remove from quote cart'
                : 'Decrease quantity'
            }
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <span className="min-w-6 text-center text-sm font-medium tabular-nums text-slate-900">
            {cartQuantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(product.id, cartQuantity + 1)}
            className="flex h-full flex-1 items-center justify-center text-slate-500 hover:text-slate-900"
            aria-label="Increase quantity"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

        <button
          type="button"
          onClick={() => onRequestQuote(product, inCart ? cartQuantity : 1)}
          className="mt-3 text-center text-sm font-medium text-slate-400 transition hover:text-brand-600"
        >
          Request a quote for just this item
        </button>
      </div>
    </article>
  );
};

export default ProductCard;
