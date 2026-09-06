import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '../lib/cn';
import EmptyState from './EmptyState';
import Pagination from './Pagination';

/**
 * The workhorse — roughly 12 of the 18 screens are a list rendered through this.
 *
 * columns: [{ key, header, align, width, render(row), className, headerClassName,
 *              sortable, sortValue(row) }]
 *   align: 'left' (default) | 'right' | 'center'.  Numeric columns should use
 *   'right'; tabular-nums is applied globally to table cells in index.css.
 *   sortable: true enables click-to-sort on that column's header. sortValue
 *   defaults to row[col.key] — pass it whenever the cell renders something
 *   other than the raw sort value (e.g. a formatted date or a nested field).
 *
 * pageSize: rows per page (client-side). Pass 0 to disable pagination.
 * defaultSort: { key, direction } — sorted client-side before pagination.
 */
const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const DataTable = ({
  columns = [],
  rows = [],
  onRowClick,
  getRowKey,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  className = '',
  pageSize = 10,
  defaultSort,
}) => {
  const shell = 'rounded-lg border border-slate-200 bg-white';
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(defaultSort ?? null);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((col) => col.key === sort.key);
    if (!column) return rows;
    const accessor = column.sortValue ?? ((row) => row[column.key]);
    const factor = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => factor * compareValues(accessor(a), accessor(b)));
  }, [rows, sort, columns]);

  const toggleSort = (column) => {
    if (!column.sortable) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: 'asc' };
      if (current.direction === 'asc') return { key: column.key, direction: 'desc' };
      return null;
    });
  };

  if (!rows.length) {
    return (
      <div className={cn(shell, className)}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  const pageRows = pageSize > 0 ? sortedRows.slice((page - 1) * pageSize, page * pageSize) : sortedRows;

  return (
    <div className={cn(shell, className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const SortIcon = isSorted ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;

                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase',
                      alignClass[col.align] ?? alignClass.left,
                      col.headerClassName
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className={cn(
                          'inline-flex items-center gap-1 transition-colors hover:text-slate-700',
                          col.align === 'right' && 'flex-row-reverse',
                          isSorted && 'text-slate-700'
                        )}
                      >
                        {col.header}
                        <SortIcon className={cn('size-3.5', !isSorted && 'text-slate-300')} aria-hidden="true" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row, index) => (
              <tr
                key={getRowKey ? getRowKey(row, index) : (row.id ?? index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-slate-50'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5 text-slate-700',
                      alignClass[col.align] ?? alignClass.left,
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
};

export default DataTable;
