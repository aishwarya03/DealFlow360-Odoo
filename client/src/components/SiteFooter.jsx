import { Link } from 'react-router-dom';

import ClientLogo from './ClientLogo';

const SiteFooter = () => (
  <footer className="border-t border-slate-200 bg-slate-50">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
      <div>
        <ClientLogo />
        <p className="mt-1.5 text-xs text-slate-500">Bengaluru, Karnataka</p>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <Link to="/products" className="hover:text-slate-600">
          Products &amp; Services
        </Link>
        <Link to="/about" className="hover:text-slate-600">
          About
        </Link>
        <Link to="/login" className="hover:text-slate-600">
          Staff Login
        </Link>
        <span>Powered by DealFlow360</span>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
