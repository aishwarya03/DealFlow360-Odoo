import { useContext } from 'react';

import { PortalAuthContext } from '../context/portalAuthInstance';

export const usePortalAuth = () => {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used inside PortalAuthProvider');
  return ctx;
};
