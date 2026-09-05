import { useEffect, useState } from 'react';

import * as authApi from '../api/auth';
import { getToken } from '../api/client';
import { AuthContext } from './authContextInstance';

/*
 * Restores the session from a stored token by re-fetching /me rather than
 * trusting a decoded JWT — the server re-checks the account on every call,
 * so a deactivated user or an expired token is caught immediately instead
 * of surfacing later as a confusing 401 mid-screen. See docs/API.html
 * "Authentication".
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      if (!getToken()) {
        setIsLoading(false);
        return;
      }

      try {
        setUser(await authApi.fetchCurrentUser());
      } catch {
        // Interceptor already cleared the token and will redirect on 401.
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const login = async (email, password) => {
    const loggedInUser = await authApi.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
