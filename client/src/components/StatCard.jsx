import { cn } from '../lib/cn';
import { TONE_TEXT } from '../lib/status';

const StatCard = ({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  onClick,
  className = '',
}) => {
  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4 text-left',
        onClick && 'w-full transition-colors hover:border-slate-300 hover:bg-slate-50',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
      </div>

      <p
        className={cn(
          'mt-2 text-2xl font-semibold tabular-nums',
          tone ? TONE_TEXT[tone] : 'text-slate-900'
        )}
      >
        {value}
      </p>

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Element>
  );
};

export default StatCard;
