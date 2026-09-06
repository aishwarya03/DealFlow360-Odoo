import { useState } from 'react';

import { cn } from '../lib/cn';
import EmptyState from './EmptyState';

// Same five tones as everywhere else in the app (docs/DESIGN_SYSTEM.md) —
// a column's accent strip and count badge just repaint StatusBadge's palette
// onto the board itself, never a new color.
const TONE_ACCENT = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

const TONE_BADGE = {
  neutral: 'bg-slate-200 text-slate-700',
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
};

/**
 * Odoo-style status-column board (docs/DESIGN_SYSTEM.md component inventory
 * — "KanbanBoard — Quotations pipeline (3) only", the first consumer).
 * Colored top accent per column, a count pill, and a card slot that's fully
 * caller-rendered so per-domain quick actions (an inline Approve button,
 * for example) can live right on the card.
 *
 * Deliberately dumb about business rules: it only ever calls `onDrop` when
 * `canDrop` said yes, and never mutates `rows` itself — the caller decides
 * what a drop actually means (which, for a state-machine-governed record
 * like a quotation, is almost never "just overwrite the status").
 *
 * columns:  [{ key, label, tone, headerAction }] — tone is one of the five
 *   design-system tones above (colors the column's top strip + count pill);
 *   headerAction is an optional node rendered top-right of the header (an
 *   Odoo-style per-column "+" quick-add, say).
 * rows:     items to place into columns via getColumnKey(row)
 * canDrag(row): should this card be draggable at all
 * canDrop(row, fromKey, toKey): { allowed, reason } — reason shown as a toast
 *   equivalent by the caller when a drop is rejected (onInvalidDrop)
 * getCardAccentClassName(row): optional extra className for the card's left
 *   edge (a colored `border-l-4`, matching that row's own status).
 */
const KanbanBoard = ({
  columns,
  rows,
  getColumnKey = (row) => row.status,
  getRowKey = (row) => row.id,
  renderCard,
  renderColumnSummary,
  getCardAccentClassName,
  onCardClick,
  canDrag = () => true,
  canDrop = () => ({ allowed: false }),
  onDrop,
  onInvalidDrop,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
}) => {
  const [dragging, setDragging] = useState(null); // { row, fromKey }
  const [dragOverKey, setDragOverKey] = useState(null);

  const grouped = columns.map((column) => ({
    ...column,
    items: rows.filter((row) => getColumnKey(row) === column.key),
  }));

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {grouped.map((column) => {
        const isDragOver = dragOverKey === column.key;
        const dropCheck = dragging
          ? canDrop(dragging.row, dragging.fromKey, column.key)
          : { allowed: false };

        return (
          <div
            key={column.key}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              setDragOverKey(column.key);
            }}
            onDragLeave={() => setDragOverKey((current) => (current === column.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverKey(null);
              if (!dragging) return;
              if (dragging.fromKey === column.key) return setDragging(null);
              if (dropCheck.allowed) {
                onDrop?.(dragging.row, dragging.fromKey, column.key);
              } else {
                onInvalidDrop?.(dragging.row, dragging.fromKey, column.key, dropCheck.reason);
              }
              setDragging(null);
            }}
            className={cn(
              'flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-slate-50/60 transition-colors',
              isDragOver && (dropCheck.allowed ? 'border-brand-400 bg-brand-50/60' : 'border-red-300 bg-red-50/50'),
              !isDragOver && 'border-slate-200'
            )}
          >
            <div className={cn('h-1', TONE_ACCENT[column.tone] ?? 'bg-slate-300')} />
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  {column.label}
                </span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                    TONE_BADGE[column.tone] ?? 'bg-slate-200 text-slate-700'
                  )}
                >
                  {column.items.length}
                </span>
              </div>
              {column.headerAction}
            </div>

            {renderColumnSummary && column.items.length > 0 && (
              <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
                {renderColumnSummary(column.items)}
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto p-2.5" style={{ maxHeight: '65vh' }}>
              {column.items.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-slate-400">No quotations here</p>
              ) : (
                column.items.map((row) => {
                  const draggable = canDrag(row);
                  return (
                    <div
                      key={getRowKey(row)}
                      draggable={draggable}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging({ row, fromKey: column.key });
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDragOverKey(null);
                      }}
                      onClick={() => onCardClick?.(row)}
                      className={cn(
                        'select-none rounded-md border border-l-4 border-slate-200 bg-white p-3 shadow-2xs transition-shadow hover:shadow-sm',
                        getCardAccentClassName?.(row),
                        onCardClick && 'cursor-pointer',
                        draggable && 'cursor-grab active:cursor-grabbing'
                      )}
                    >
                      {renderCard(row)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
