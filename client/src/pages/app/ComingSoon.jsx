import { Construction } from 'lucide-react';

import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';

/*
 * Placeholder for the rep-workspace tabs (Quotations onward) — routed and
 * role-gated already so the nav is honest about the full planned shell, but
 * there is no backend behind them yet. Swapped for a real screen slice by
 * slice; nothing else references this component by name.
 */
const ComingSoon = ({ title, description }) => (
  <div>
    <PageHeader title={title} />
    <div className="rounded-lg border border-slate-200 bg-white">
      <EmptyState
        icon={Construction}
        title="Not built yet"
        description={description ?? `${title} lands in a later slice — the nav item and role gate are already in place.`}
      />
    </div>
  </div>
);

export default ComingSoon;
