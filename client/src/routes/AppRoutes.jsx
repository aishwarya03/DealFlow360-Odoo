import { BrowserRouter, Routes, Route } from 'react-router-dom';

import About from '../pages/About';
import Cart from '../pages/Cart';
import Landing from '../pages/Landing';
import Products from '../pages/Products';
import RequestQuote from '../pages/RequestQuote';
import NotFound from '../pages/NotFound';
import Home from '../pages/Home';

/*
 * No global Layout: the public site, the internal AppShell (teammate's
 * scope) and the customer PortalShell each need different chrome, so layout
 * is chosen per route/page instead.
 */
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/products" element={<Products />} />
        <Route path="/about" element={<About />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/request-quote" element={<RequestQuote />} />

        {/* Backend connectivity check, kept out of the way. */}
        <Route path="/dev/ping" element={<Home />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
