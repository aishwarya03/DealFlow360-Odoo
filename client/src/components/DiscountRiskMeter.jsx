import { ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Visual Discount Governance Risk Meter showing how discounts route through approvals.
 * Rules:
 *   ≤ 10%: Rep Auto-approved (Green)
 *   10.1% - 20%: Sales Manager Approval (Amber)
 *   > 20%: Finance Approval / Breach (Red)
 */
const DiscountRiskMeter = ({
  discountPercent = 0,
  maxDiscount = 35,
  className = '',
}) => {
  const percent = Math.max(0, Number(discountPercent) || 0);

  // Determine active band
  let badgeLabel = 'Auto-approved (Rep)';
  let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let Icon = ShieldCheck;

  if (percent > 20) {
    badgeLabel = 'Finance Approval Required';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = ShieldAlert;
  } else if (percent > 10) {
    badgeLabel = 'Sales Manager Approval';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = UserCheck;
  }

  // Calculate percentage width for marker (capped at 100%)
  const markerPosition = Math.min(100, (percent / maxDiscount) * 100);

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4 shadow-2xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Discount Governance Risk
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {percent.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">blended discount</span>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
            badgeClass
          )}
        >
          <Icon className="size-3.5" />
          {badgeLabel}
        </span>
      </div>

      {/* Meter Bar */}
      <div className="relative mt-4">
        {/* Tier Bar Track */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {/* 0-10% (auto-approved): 10/35 = 28.5% */}
          <div
            style={{ width: `${(10 / maxDiscount) * 100}%` }}
            className="bg-emerald-500 transition-all duration-300"
            title="0-10%: Rep Auto"
          />
          {/* 10-20% (manager): 10/35 = 28.5% */}
          <div
            style={{ width: `${(10 / maxDiscount) * 100}%` }}
            className="bg-amber-500 transition-all duration-300"
            title="10-20%: Sales Manager"
          />
          {/* 20-35% (finance): 15/35 = 43% */}
          <div
            style={{ width: `${(15 / maxDiscount) * 100}%` }}
            className="bg-rose-500 transition-all duration-300"
            title=">20%: Finance Approval"
          />
        </div>

        {/* Current Marker Pin */}
        <div
          className="absolute -top-1 size-4.5 -translate-x-1/2 rounded-full border-2 border-white bg-slate-950 shadow-md transition-all duration-300"
          style={{ left: `${markerPosition}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Threshold Labels */}
      <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
        <span>0% (Standard)</span>
        <span className="text-emerald-700">10% (Rep Limit)</span>
        <span className="text-amber-700">20% (Manager Limit)</span>
        <span className="text-rose-700">{maxDiscount}%+ (Finance)</span>
      </div>
    </div>
  );
};

export default DiscountRiskMeter;
