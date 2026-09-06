import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { computeBlendedDiscountRisk } from '../lib/quotationLines';
import SmartButton from './SmartButton';
import StatusBadge from './StatusBadge';

/**
 * Discount Governance Risk — one real number for the whole quotation, shown
 * as a smart button (docs/DESIGN_SYSTEM.md's Odoo-style pattern, same as the
 * Invoice button next to it) instead of its own card. The per-line detail
 * behind this number already lives in the Lines table's OVER/OK badges —
 * repeating it here was the "wrong representation" this replaces.
 *
 * The percentage is computeBlendedDiscountRisk's value-weighted excess-over-
 * ceiling (docs/SOURCE_OF_TRUTH §3.2's own formula) — 0% whenever every line
 * is within its own discount ceiling, never a guessed approval level.
 */
const DiscountRiskMeter = ({ lines = [], onClick }) => {
  const riskPercent = computeBlendedDiscountRisk(lines);
  const isCompliant = riskPercent === 0;

  return (
    <SmartButton
      icon={isCompliant ? ShieldCheck : ShieldAlert}
      label="Discount Risk"
      onClick={onClick}
      value={
        <span className="inline-flex items-center gap-1.5">
          {riskPercent.toFixed(1)}%
          <StatusBadge status={isCompliant ? 'OK' : 'OVER'} />
        </span>
      }
    />
  );
};

export default DiscountRiskMeter;
