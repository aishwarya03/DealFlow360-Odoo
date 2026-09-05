import { cn } from '../lib/cn';
import EmptyState from './EmptyState';

/**
 * The workhorse — roughly 12 of the 18 screens are a list rendered through this.
 *
 * columns: [{ key, header, align, width, render(row), className, headerClassName }]
 *   align: 'left' (default) | 'right' | 'center'.  Numeric columns should use
 *   'right'; tabular-nums is applied globally to table cells in index.css.
 */
const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
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
}) => {
  const shell = 'rounded-lg border border-slate-200 bg-white';

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

  return (
    <div className={cn('overflow-x-auto', shell, className)}>
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
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
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
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
  );
};

export default DataTable;
