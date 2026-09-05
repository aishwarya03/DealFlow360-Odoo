import { cn } from '../lib/cn';

/**
 * Segmented filter used by the list screens (Approvals, Subscriptions, Invoices).
 * options: [{ value, label, count }]
 */
const FilterBar = ({ options = [], value, onChange, children, className = '' }) => (
  <div
    className={cn('flex flex-wrap items-center justify-between gap-3', className)}
  >
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            {option.label}
            {option.count != null && (
              <span
                className={cn(
                  'ml-1.5 tabular-nums',
                  isActive ? 'text-brand-200' : 'text-slate-400'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>

    {children && <div className="flex items-center gap-2">{children}</div>}
  </div>
);

export default FilterBar;
