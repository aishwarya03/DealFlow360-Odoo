import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';

/*
 * Placeholder for the rep-workspace tabs (Quotations onward) — routed and
 * role-gated already so the nav is honest about the full planned shell, but
 * there is no backend behind them yet. Swapped for a real screen slice by
 * slice; nothing else references this component by name.
 */
const ComingSoon = ({ title, description }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle="On the roadmap" />
      <div className="rounded-lg border border-slate-200 bg-white animate-fade-in">
        <EmptyState
          icon={Construction}
          title="Not built yet"
          description={
            description ?? `${title} lands in a later slice — the nav item and role gate are already in place.`
          }
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/workspace')}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Dashboard
            </Button>
          }
        />
      </div>
    </div>
  );
};

export default ComingSoon;
