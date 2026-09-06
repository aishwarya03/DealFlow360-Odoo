import { cn } from '../lib/cn';

/**
 * Modern toggle switch component replacing clunky checkboxes for binary options.
 */
const Switch = ({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const isSmall = size === 'sm';

  const toggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      onClick={toggle}
      className={cn(
        'group inline-flex items-center gap-3 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={cn(
          'relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2',
          isSmall ? 'h-4 w-7' : 'h-5 w-9',
          checked ? 'bg-brand-600' : 'bg-slate-200 group-hover:bg-slate-300',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out transform',
            isSmall
              ? checked
                ? 'h-3 w-3 translate-x-3.5 translate-y-0.5'
                : 'h-3 w-3 translate-x-0.5 translate-y-0.5'
              : checked
                ? 'h-4 w-4 translate-x-4.5 translate-y-0.5'
                : 'h-4 w-4 translate-x-0.5 translate-y-0.5'
          )}
        />
      </button>

      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={cn('font-medium text-slate-800', isSmall ? 'text-xs' : 'text-sm')}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-slate-400">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default Switch;
