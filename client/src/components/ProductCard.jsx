import { Minus, Plus, ShoppingCart } from 'lucide-react';

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
  const Icon = CATEGORY_ICONS[product.category];

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
      <div className="mx-auto flex aspect-square w-28 shrink-0 items-center justify-center rounded-md bg-slate-100 sm:w-32">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full rounded-md object-contain"
          />
        ) : (
          <Icon className="size-9 text-slate-400" aria-hidden="true" />
        )}
      </div>

      <p className="mt-4 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {CATEGORY_LABELS[product.category]}
      </p>
      <h3 className="mt-0.5 text-sm font-semibold text-slate-900">
        {product.name}
      </h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">
        {product.description}
      </p>
      <p className="mt-3 text-base font-semibold tabular-nums text-slate-900">
        {formatPrice(product)}
      </p>

      <div className="relative mt-4 h-9">
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
        className="mt-2 text-xs font-medium text-slate-500 hover:text-brand-600"
      >
        Request a quote for just this item
      </button>
    </div>
  );
};

export default ProductCard;
