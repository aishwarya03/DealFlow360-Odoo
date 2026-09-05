import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';

/*
 * Client-side gating is a UX convenience only — every rule it enforces is
 * re-checked server-side (authenticateInternal / authorize), which is the
 * copy that actually matters. This just avoids flashing a screen a role
 * can't act on before the API call comes back 403.
 */
const ProtectedRoute = ({ children, roles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo className="animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/workspace" replace />;
  }

  return children;
};

export default ProtectedRoute;
