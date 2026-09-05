import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { createRecommendation, deactivateRecommendation, listRecommendations } from '../api/recommendations';
import { searchProducts } from '../lib/quotationLines';
import Button from './Button';
import SearchSelect from './SearchSelect';

const TYPE_LABEL = { CROSS_SELL: 'Cross-sell', UPSELL: 'Upsell' };

/*
 * Lets an admin curate which products this one recommends whenever it's
 * already in an order — the catalog config that powers the suggestion
 * engine everywhere else (product pages, cart, quotation builder). Only
 * reachable for a product that already has an id; a brand-new, unsaved
 * product has nothing for a recommendation to point at yet.
 */
const ProductRecommendationsPanel = ({ productId }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetId, setTargetId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [type, setType] = useState('CROSS_SELL');
  const [promoted, setPromoted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    listRecommendations({ sourceProductId: productId })
      .then(setRecommendations)
      .catch(() => toast.error('Could not load recommendations'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const addRecommendation = async () => {
    if (!targetId) return toast.error('Choose a product to recommend');
    setIsSaving(true);
    try {
      await createRecommendation({
        sourceProductId: productId,
        targetProductId: Number(targetId),
        type,
        promoted,
      });
      toast.success('Recommendation added');
      setTargetId('');
      setTargetLabel('');
      setPromoted(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not add recommendation');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (recommendation) => {
    try {
      await deactivateRecommendation(recommendation.id);
      setRecommendations((current) => current.filter((row) => row.id !== recommendation.id));
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Could not remove recommendation');
    }
  };

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-sm font-medium text-slate-700">Cross-sell & upsell</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Suggested whenever this product is already in a quotation, cart, or product page.
      </p>

      {!isLoading && recommendations.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            >
              <span className="truncate">
                <span className="font-medium text-slate-900">{TYPE_LABEL[rec.type]}</span>
                <span className="text-slate-500"> → {rec.target?.name ?? `#${rec.targetProductId}`}</span>
                {rec.promoted && <span className="ml-1.5 text-xs font-semibold text-brand-600">Featured</span>}
              </span>
              <button
                type="button"
                onClick={() => remove(rec)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove recommendation to ${rec.target?.name ?? rec.targetProductId}`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-12 items-end gap-2">
        <div className="col-span-6">
          <SearchSelect
            label="Recommend"
            value={targetId}
            displayValue={targetLabel}
            onSelect={(option) => {
              setTargetId(option ? String(option.value) : '');
              setTargetLabel(option ? option.label : '');
            }}
            search={async (query) => (await searchProducts(query)).filter((option) => option.value !== productId)}
            placeholder="Search products…"
          />
        </div>

        <div className="col-span-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-700">As</label>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-600"
          >
            <option value="CROSS_SELL">Cross-sell</option>
            <option value="UPSELL">Upsell</option>
          </select>
        </div>

        <div className="col-span-2 flex items-center gap-1.5 pb-2">
          <input
            type="checkbox"
            id="rec-promoted"
            checked={promoted}
            onChange={(event) => setPromoted(event.target.checked)}
          />
          <label htmlFor="rec-promoted" className="text-xs text-slate-600">
            Featured
          </label>
        </div>

        <div className="col-span-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isSaving || !targetId}
            onClick={addRecommendation}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductRecommendationsPanel;
