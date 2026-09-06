import { Check } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Modern styled checkbox with custom checkmark icon.
 */
const CustomCheckbox = ({
  checked = false,
  onChange,
  label,
  id,
  disabled = false,
  className = '',
}) => {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-2.5 select-none cursor-pointer text-sm font-medium text-slate-700',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={cn(
            'flex size-4 items-center justify-center rounded border transition-all duration-150',
            checked
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-300 bg-white hover:border-slate-400 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1'
          )}
        >
          {checked && <Check className="size-3 stroke-[3]" aria-hidden="true" />}
        </div>
      </div>
      {label && <span>{label}</span>}
    </label>
  );
};

export default CustomCheckbox;
