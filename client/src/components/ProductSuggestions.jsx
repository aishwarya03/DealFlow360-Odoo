import { useEffect, useState } from 'react';
import { Package, Plus, Sparkles } from 'lucide-react';

import { getPublicSuggestions } from '../api/recommendations';
import { formatINR } from '../lib/currency';

const GROUP_LABEL = { CROSS_SELL: 'Frequently bought together', UPSELL: 'You might prefer' };

const resolveImageUrl = (imageUrl) =>
  !imageUrl ? null : imageUrl.startsWith('http') ? imageUrl : `${import.meta.env.VITE_API_URL}${imageUrl}`;

/*
 * Cross-sell/upsell suggestions for whatever is currently in view — one
 * product on its detail page, or everything in the quote cart. Evaluated
 * against the catalog-configured ProductRecommendation pairs (admin-curated
 * in the internal Products screen); purely advisory; renders nothing while
 * there's nothing to suggest.
 */
const ProductSuggestions = ({ productIds, onAdd, className = '' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const key = [...new Set(productIds ?? [])].sort((a, b) => a - b).join(',');

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setSuggestions([]);
      return undefined;
    }
    getPublicSuggestions(key.split(',').map(Number))
      .then((result) => !cancelled && setSuggestions(result))
      .catch(() => !cancelled && setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (suggestions.length === 0) return null;

  const groups = ['CROSS_SELL', 'UPSELL']
    .map((type) => ({ type, items: suggestions.filter((s) => s.type === type) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className={className}>
      {groups.map((group) => (
        <div key={group.type} className="mt-10 first:mt-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Sparkles className="size-4 text-brand-600" aria-hidden="true" />
            {GROUP_LABEL[group.type]}
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((suggestion) => {
              const imageUrl = resolveImageUrl(suggestion.product.imageUrl);
              return (
                <div
                  key={suggestion.recommendationId}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-100">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="size-full rounded-md object-contain" />
                    ) : (
                      <Package className="size-5 text-slate-300" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{suggestion.product.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatINR(suggestion.product.listPrice)}
                      {suggestion.product.isSubscribable ? ' / mo' : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAdd(suggestion.product)}
                    className="shrink-0 rounded-md border border-slate-300 p-2 text-slate-500 transition hover:border-brand-600 hover:text-brand-600"
                    aria-label={`Add ${suggestion.product.name} to your quote cart`}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductSuggestions;
