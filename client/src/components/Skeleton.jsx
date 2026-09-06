import { cn } from '../lib/cn';

/**
 * Base shimmering skeleton block.
 */
export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200/80',
        className
      )}
      {...props}
    />
  );
};

/**
 * Multi-line text skeleton.
 */
export const SkeletonText = ({ lines = 3, className = '' }) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-3.5',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton placeholder for DataTable rows.
 */
export const SkeletonTable = ({ rows = 5, cols = 4, className = '' }) => {
  return (
    <div className={cn('w-full space-y-3 p-4', className)}>
      <div className="flex gap-4 border-b border-slate-100 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                'h-4 flex-1',
                c === 0 ? 'w-1/3' : 'w-full'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for StatCard / dashboard tiles.
 */
export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4 space-y-3', className)}>
      <div className="flex justify-between items-center">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2.5 w-32" />
    </div>
  );
};

export default Skeleton;
