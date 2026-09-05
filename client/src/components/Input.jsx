import { cn } from '../lib/cn';

const Input = ({ label, error, hint, id, className = '', ...props }) => {
  const inputId = id ?? props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400',
          error
            ? 'border-red-500 focus:border-red-600'
            : 'border-slate-300 focus:border-brand-600',
          className
        )}
        {...props}
      />

      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
};

export default Input;
