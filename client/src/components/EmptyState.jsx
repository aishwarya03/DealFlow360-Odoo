import { cn } from '../lib/cn';

const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in',
      className
    )}
  >
    {Icon && (
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="size-6 text-slate-400" aria-hidden="true" />
      </div>
    )}
    <p className="text-base font-semibold text-slate-900">{title}</p>
    {description && (
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
