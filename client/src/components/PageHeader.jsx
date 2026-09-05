import { cn } from '../lib/cn';

const PageHeader = ({ title, subtitle, actions, className = '' }) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-4 pb-5',
      className
    )}
  >
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>

    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
