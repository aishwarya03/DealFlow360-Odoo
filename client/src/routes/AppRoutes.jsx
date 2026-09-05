import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Landing from '../pages/Landing';
import NotFound from '../pages/NotFound';
import Home from '../pages/Home';

/*
 * No global Layout: the landing page, the internal AppShell and the customer
 * PortalShell each need different chrome, so layout is chosen per route.
 */
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Backend connectivity check, kept out of the way. */}
        <Route path="/dev/ping" element={<Home />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
