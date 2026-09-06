import { Search, X } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Debounce the value yourself at the call site (useDebouncedValue) before
 * filtering — this component just renders the box and reports every
 * keystroke immediately, so typing itself never feels laggy.
 */
const SearchInput = ({ value, onChange, placeholder = 'Search…', className = '' }) => (
  <div className={cn('relative w-full max-w-xs', className)}>
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-600"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
        aria-label="Clear search"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    )}
  </div>
);

export default SearchInput;
