import { cn } from '../lib/cn';
import { resolveStatus, TONE_CLASSES, TONE_DOT } from '../lib/status';

/**
 * The only way a status color should reach the screen.
 * Pass a state key from lib/status.js — the tone is looked up, never chosen here.
 */
const StatusBadge = ({ status, label, dot = false, className = '' }) => {
  const { label: resolvedLabel, tone } = resolveStatus(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASSES[tone],
        className
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />}
      {label ?? resolvedLabel}
    </span>
  );
};

export default StatusBadge;
