import { cn } from '../lib/cn';

const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center px-6 py-12 text-center',
      className
    )}
  >
    {Icon && <Icon className="mb-3 size-8 text-slate-300" aria-hidden="true" />}
    <p className="text-sm font-medium text-slate-900">{title}</p>
    {description && (
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
