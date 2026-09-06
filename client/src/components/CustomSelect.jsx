import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Modern CustomSelect replacing native HTML <select>.
 * Options: Array of { value, label, hint, badge, tone, disabled } or raw strings/numbers.
 */
const CustomSelect = ({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select an option…',
  disabled = false,
  error,
  hint,
  searchable = false,
  size = 'md',
  className = '',
}) => {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options into uniform shape: { value, label, hint, badge, disabled }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label ?? String(opt.value),
        hint: opt.hint,
        badge: opt.badge,
        tone: opt.tone,
        disabled: Boolean(opt.disabled),
      };
    }
    return {
      value: opt,
      label: String(opt),
      disabled: false,
    };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.hint && opt.hint.toLowerCase().includes(term))
    );
  });

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input on open if searchable
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isOpen) {
      setFocusedIndex(-1);
    } else {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev + 1;
        return next >= filteredOptions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredOptions.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        const opt = filteredOptions[focusedIndex];
        if (!opt.disabled) {
          onChange?.(opt.value);
          setIsOpen(false);
        }
      }
    }
  };

  const isSmall = size === 'sm';

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'group flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-left transition-all duration-150 outline-none',
          isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : isOpen
              ? 'border-brand-600 ring-2 ring-brand-100'
              : 'border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
          disabled && 'cursor-not-allowed bg-slate-50 text-slate-400 opacity-70'
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-medium text-slate-900">{selectedOption.label}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <div className="flex shrink-0 items-center gap-1.5 text-slate-400 group-hover:text-slate-600">
          {selectedOption?.badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-200',
              isOpen && 'rotate-180 text-brand-600'
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 w-full min-w-[12rem] rounded-lg border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5"
          style={{ maxHeight: '18rem' }}
        >
          {searchable && (
            <div className="relative border-b border-slate-100 p-1.5">
              <Search className="pointer-events-none absolute left-3 top-3 size-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type to filter…"
                className="w-full rounded-md bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-brand-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-52 overflow-y-auto py-0.5 space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-slate-400">
                No matching options
              </p>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isFocused = idx === focusedIndex;

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange?.(opt.value);
                        setIsOpen(false);
                      }
                    }}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : isFocused
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50',
                      opt.disabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-[11px] text-slate-400">({opt.hint})</span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {opt.badge && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="size-3.5 text-brand-600" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
};

export default CustomSelect;
