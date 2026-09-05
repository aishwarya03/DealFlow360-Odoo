import { cn } from '../lib/cn';

/** A titled panel. Pass padded={false} when the body is a DataTable. */
const DetailSection = ({
  title,
  description,
  actions,
  children,
  padded = true,
  className = '',
}) => (
  <section className={cn('rounded-lg border border-slate-200 bg-white', className)}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          {title && (
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          )}
          {description && (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    )}

    <div className={padded ? 'p-4' : undefined}>{children}</div>
  </section>
);

export default DetailSection;
