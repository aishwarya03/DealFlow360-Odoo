import { useEffect, useState } from 'react';

import { clearPortalToken, getCurrentCustomer, getPortalToken, portalLogin } from '../api/portal';
import { PortalAuthContext } from './portalAuthInstance';

/*
 * Customer-facing session, kept separate from AuthContext (staff) because
 * it's a different token audience — see client/src/api/portal.js. A stored
 * token is re-verified against /auth/me rather than trusted, so a
 * deactivated account or an expired token is caught on load instead of
 * surfacing later as a confusing 401 mid-screen.
 */
export const PortalAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      if (!getPortalToken()) {
        setIsLoading(false);
        return;
      }

      try {
        setCustomer(await getCurrentCustomer());
      } catch {
        clearPortalToken();
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const login = async (email, password) => {
    const { customer: loggedInCustomer } = await portalLogin(email, password);
    setCustomer(loggedInCustomer);
    return loggedInCustomer;
  };

  const logout = () => {
    clearPortalToken();
    setCustomer(null);
  };

  return (
    <PortalAuthContext.Provider value={{ customer, isLoading, login, logout, setCustomer }}>
      {children}
    </PortalAuthContext.Provider>
  );
};
