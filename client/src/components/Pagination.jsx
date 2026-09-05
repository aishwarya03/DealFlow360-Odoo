import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Prev/Next + "Page X of Y" control shared by every paginated list view.
 */
const Pagination = ({ page, totalPages, onPageChange, className = '' }) => {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Prev
      </button>
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default Pagination;
