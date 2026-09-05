import { Navigate, useLocation } from 'react-router-dom';

import { usePortalAuth } from '../hooks/usePortalAuth';
import Logo from './Logo';

/*
 * Client-side gating only, same tradeoff as ProtectedRoute (staff): every
 * portal route the customer reaches is re-checked server-side against their
 * token, this just avoids flashing a screen before a 401 would come back.
 */
const PortalProtectedRoute = ({ children }) => {
  const { customer, isLoading } = usePortalAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo className="animate-pulse" />
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/portal/login" state={{ from: location.pathname }} replace />;
  }

  return children;
};

export default PortalProtectedRoute;
