import { useEffect } from 'react';

const FAVICON_LINK_ID = 'app-favicon';

/**
 * Two brands share this one SPA (docs/DEMO_SCENARIO.md): the public site and
 * customer portal are Netrix, staff auth and the internal workspace are
 * DealFlow360. This is what makes that split visible on the browser tab
 * itself, not just in the page content.
 */
export function useBrandTag(title, iconHref) {
  useEffect(() => {
    document.title = title;
    document.getElementById(FAVICON_LINK_ID)?.setAttribute('href', iconHref);
  }, [title, iconHref]);
}

export const NETRIX_TAG = { title: 'Netrix Systems', icon: '/favicon-netrix.svg' };
export const DEALFLOW_TAG = { title: 'DealFlow360', icon: '/favicon-dealflow.svg' };
