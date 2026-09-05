import { Check, X } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Used for the approval chain (Submitted -> Sales Manager -> Finance ->
 * Confirmed) and invoice progress (Order Confirmed -> Shipped -> Invoiced -> Paid).
 *
 * steps: [{ label, status: 'done' | 'active' | 'pending' | 'rejected' | 'returned', meta }]
 * rejected/returned exist because, unlike an invoice's progress, an approval
 * chain can end without ever reaching 'done' — same red/amber split as
 * REJECTED/RETURNED in lib/status.js.
 */
const dotStyles = {
  done: 'bg-green-600 text-white',
  active: 'bg-blue-600 text-white ring-4 ring-blue-100',
  pending: 'bg-slate-200 text-slate-500',
  rejected: 'bg-red-600 text-white',
  returned: 'bg-amber-500 text-white',
};

const labelStyles = {
  done: 'text-slate-900',
  active: 'text-blue-700 font-medium',
  pending: 'text-slate-400',
  rejected: 'text-red-700 font-medium',
  returned: 'text-amber-700 font-medium',
};

const STOPPED_STATUSES = new Set(['rejected', 'returned']);

const StepProgress = ({ steps = [], className = '' }) => (
  <ol className={cn('flex items-start', className)}>
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;

      return (
        <li
          key={step.label ?? index}
          className={cn('flex items-start', !isLast && 'flex-1')}
        >
          <div className="flex w-24 shrink-0 flex-col items-center text-center">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                dotStyles[step.status] ?? dotStyles.pending
              )}
            >
              {step.status === 'done' ? (
                <Check className="size-4" aria-hidden="true" />
              ) : STOPPED_STATUSES.has(step.status) ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>

            <span
              className={cn(
                'mt-2 text-xs',
                labelStyles[step.status] ?? labelStyles.pending
              )}
            >
              {step.label}
            </span>

            {step.meta && (
              <span className="mt-0.5 text-[11px] text-slate-400">{step.meta}</span>
            )}
          </div>

          {!isLast && (
            <span
              className={cn(
                'mt-3.5 h-0.5 flex-1 rounded',
                step.status === 'done' ? 'bg-green-600' : 'bg-slate-200'
              )}
            />
          )}
        </li>
      );
    })}
  </ol>
);

export default StepProgress;
