import { cn } from '../lib/cn';

/**
 * Odoo's "smart button" pattern: a small bordered stat that opens the
 * related record on click, rather than performing an action itself. Used
 * where a page header needs to surface "there's a related X" (e.g. an
 * invoice) without it looking like just another action button.
 *
 * Without an `onClick`, it renders as a plain (non-interactive) tag instead
 * of a `<button>` — a stat with nothing to drill into shouldn't get a
 * pointer cursor and a hover state promising a click that does nothing.
 */
const SmartButton = ({ icon: Icon, label, value, onClick, className = '' }) => {
  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-left transition-colors',
        onClick && 'hover:border-brand-300 hover:bg-brand-50/50',
        className
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
      <span className="leading-tight">
        <span className="block text-[11px] text-slate-400">{label}</span>
        <span className="block text-sm font-semibold text-slate-900">{value}</span>
      </span>
    </Element>
  );
};

export default SmartButton;
