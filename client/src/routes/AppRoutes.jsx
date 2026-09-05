import { BrowserRouter, Routes, Route } from 'react-router-dom';

import AppShell from '../layouts/AppShell';
import ComingSoon from '../pages/app/ComingSoon';
import CustomersPage from '../pages/app/CustomersPage';
import Dashboard from '../pages/app/Dashboard';
import InventoryPage from '../pages/app/InventoryPage';
import ProductsPage from '../pages/app/ProductsPage';
import WarehousesPage from '../pages/app/WarehousesPage';
import Home from '../pages/Home';
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import NotFound from '../pages/NotFound';
import ProtectedRoute from '../components/ProtectedRoute';

/*
 * No global Layout: the landing page, the internal AppShell and the customer
 * PortalShell each need different chrome, so layout is chosen per route.
 *
 * Everything under /workspace is one ProtectedRoute — role-gating within it
 * is handled by AppShell only rendering the nav items a role can reach
 * (client/src/lib/roles.js). That's a UX convenience only; the real
 * enforcement is server-side on every request (see docs/API.html).
 */
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Backend connectivity check, kept out of the way. */}
        <Route path="/dev/ping" element={<Home />} />

        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="warehouses" element={<WarehousesPage />} />
          <Route path="inventory" element={<InventoryPage />} />

          <Route path="quotations" element={<ComingSoon title="Quotations" />} />
          <Route path="approvals" element={<ComingSoon title="Approvals" />} />
          <Route path="fulfillment" element={<ComingSoon title="Fulfillment" />} />
          <Route path="subscriptions" element={<ComingSoon title="Subscriptions" />} />
          <Route path="invoices" element={<ComingSoon title="Invoices" />} />
          <Route path="deal-health" element={<ComingSoon title="Deal Health" />} />
          <Route path="reports" element={<ComingSoon title="Reports" />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
