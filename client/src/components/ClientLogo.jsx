import { ShieldCheck } from 'lucide-react';

import { cn } from '../lib/cn';

/*
 * The demo tenant's mark — see docs/DEMO_SCENARIO.md. Deliberately distinct
 * from DealFlow360's own LogoMark (components/Logo.jsx): this is what the
 * public site and the customer portal show, and DealFlow360 should never
 * appear on either.
 */
const ClientLogo = ({ wordmark = true, className = '' }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <span className="flex size-7 items-center justify-center rounded-md bg-slate-900">
      <ShieldCheck className="size-4 text-white" aria-hidden="true" />
    </span>
    {wordmark && (
      <span className="text-lg font-semibold tracking-tight text-slate-900">
        Netrix Systems
      </span>
    )}
  </span>
);

export default ClientLogo;
