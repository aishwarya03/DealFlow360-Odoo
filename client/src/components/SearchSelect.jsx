import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';

/**
 * A many2one-style combobox: type to search, pick from a dropdown that
 * queries the server (debounced), rather than a plain <select> fed by one
 * pre-fetched list.
 *
 * That distinction matters beyond UX: a <select> whose options come from
 * "active records only" silently shows nothing when the bound value isn't
 * in that list — e.g. a requoted quotation line whose product has since
 * been deactivated. Here, `value`/`displayValue` are owned by the parent,
 * so a pre-filled field can show the right label from data it already has
 * (the source line's own product name) without depending on a fetch at all:
 * when closed, the input just renders `displayValue` directly; `query` only
 * exists while open, for what the user is actively typing.
 *
 * `search(query)` must resolve to `[{ value, label, hint?, raw }]` — called
 * debounced as the user types, and once on focus so the dropdown isn't
 * empty before they've typed anything. `resultsQuery` tracks which query
 * `options` actually answers, so "Searching…" and "No matches" (a
 * confirmed empty result) are never confused with each other — the naive
 * version of this flashed "No matches" on every fresh open, before the
 * first debounced search had even come back.
 */
const SearchSelect = ({
  label,
  value,
  displayValue,
  onSelect,
  search,
  placeholder = 'Type to search…',
  disabled = false,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [resultsQuery, setResultsQuery] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(query, 250);
  const isSearching = isOpen && resultsQuery !== debouncedQuery;

  // Gated on isOpen, so picking an option (which also closes the dropdown)
  // never triggers a redundant re-search. Both setState calls below run
  // inside the promise callback, not synchronously in the effect body —
  // deliberate, that's what keeps this clear of react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    search(debouncedQuery)
      .then((results) => {
        if (cancelled) return;
        setOptions(results);
        setResultsQuery(debouncedQuery);
        setHighlightedIndex(results.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setResultsQuery(debouncedQuery);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, isOpen]);

  const openDropdown = (event) => {
    // Seed the box with the current label, highlighted — typing overwrites
    // it immediately, but a click-through-without-typing still shows what's
    // actually selected instead of going blank.
    setQuery(displayValue ?? '');
    setOptions([]);
    setResultsQuery(null);
    setHighlightedIndex(-1);
    setIsOpen(true);
    event.target.select();
  };

  const choose = (option) => {
    setIsOpen(false);
    onSelect(option);
  };

  // Typing a name and hitting Enter (or tabbing away) without clicking a
  // row looked like a valid selection — the box still showed the typed
  // text — but no onSelect ever fired, so the parent's id stayed empty.
  // Committing to whatever is highlighted closes that gap.
  const commitHighlighted = () => {
    const option = options[highlightedIndex];
    if (option) choose(option);
    else setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      {label && <label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>}

      <input
        type="text"
        value={isOpen ? query : (displayValue ?? '')}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={openDropdown}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
          else if (event.key === 'Enter') {
            event.preventDefault();
            commitHighlighted();
          } else if (event.key === 'ArrowDown' && options.length > 0) {
            event.preventDefault();
            setHighlightedIndex((index) => (index + 1) % options.length);
          } else if (event.key === 'ArrowUp' && options.length > 0) {
            event.preventDefault();
            setHighlightedIndex((index) => (index - 1 + options.length) % options.length);
          }
        }}
        onBlur={() =>
          setTimeout(() => {
            // Only auto-commit if they actually typed something new — an
            // untouched field (focused then tabbed straight past) must not
            // silently overwrite an existing selection with result #1.
            if (query !== (displayValue ?? '')) commitHighlighted();
            else setIsOpen(false);
          }, 150)
        }
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 pr-7 text-sm text-slate-900 outline-none transition-colors focus:border-brand-600 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <ChevronDown
        className="pointer-events-none absolute right-2 bottom-2 size-3.5 text-slate-400"
        aria-hidden="true"
      />

      {isOpen && (
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {isSearching && <p className="px-3 py-1.5 text-xs text-slate-400">Searching…</p>}
          {!isSearching && options.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-slate-400">No matches</p>
          )}
          {!isSearching && options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50',
                (index === highlightedIndex || String(option.value) === String(value)) &&
                  'bg-brand-50 text-brand-700'
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.hint && <span className="shrink-0 text-xs text-slate-400">{option.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchSelect;
