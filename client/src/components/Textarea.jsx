import { cn } from '../lib/cn';

const Textarea = ({ label, error, hint, id, className = '', ...props }) => {
  const fieldId = id ?? props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}

      <textarea
        id={fieldId}
        className={cn(
          'w-full resize-none rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400',
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

export default Textarea;
