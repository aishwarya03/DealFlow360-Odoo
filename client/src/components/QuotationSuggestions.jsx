import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';

import { getSuggestions } from '../api/recommendations';
import { formatINR } from '../lib/currency';

const TYPE_LABEL = { CROSS_SELL: 'Cross-sell', UPSELL: 'Upsell' };

/*
 * Evaluated against whatever products are currently on the lines being
 * edited — same engine as the public cart/product-page version, but staff
 * gets margin and can see it for every product (not just the active
 * catalog a customer browses). onAdd hands back the full suggestion object
 * so the caller can attach suggestedAs/suggestedFromProductId to the new
 * line — see lib/quotationLines.js's lineFromSuggestion.
 */
const QuotationSuggestions = ({ productIds, onAdd }) => {
  const [suggestions, setSuggestions] = useState([]);
  const key = [...new Set((productIds ?? []).filter(Boolean))].sort((a, b) => a - b).join(',');

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setSuggestions([]);
      return undefined;
    }
    getSuggestions(key.split(',').map(Number))
      .then((result) => !cancelled && setSuggestions(result))
      .catch(() => !cancelled && setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-md border border-dashed border-brand-200 bg-brand-50/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Suggested for this quotation
      </p>

      <div className="mt-2 space-y-1.5">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.recommendationId}
            className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-sm"
          >
            <div className="min-w-0 truncate">
              <span className="font-medium text-slate-900">{suggestion.product.name}</span>
              <span className="ml-1.5 text-xs text-slate-400">
                {TYPE_LABEL[suggestion.type]} from {suggestion.triggeredBy.name} · {formatINR(suggestion.product.listPrice)}
                {suggestion.product.marginPercent !== undefined
                  ? ` · ${suggestion.product.marginPercent}% margin`
                  : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAdd(suggestion)}
              className="shrink-0 rounded p-1.5 text-brand-600 hover:bg-brand-100"
              aria-label={`Add ${suggestion.product.name}`}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuotationSuggestions;
