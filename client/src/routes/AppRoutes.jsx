import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Layout from '../layouts/Layout';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default AppRoutes;