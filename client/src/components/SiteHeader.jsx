import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { Bell, ShoppingCart, Wifi, WifiOff } from 'lucide-react';

import Button from './Button';
import ClientLogo from './ClientLogo';
import { useCart } from '../hooks/useCart';
import { usePortalAuth } from '../hooks/usePortalAuth';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { getPortalToken } from '../api/portal';
import { cn } from '../lib/cn';

const NAV_LINKS = [
  { to: '/products', label: 'Products & Services' },
  { to: '/about', label: 'About' },
];

/* Shared chrome for every public Netrix page — Landing, Products, About,
 * RequestQuote. One place to keep nav/login links in sync. */
const SiteHeader = () => {
  const { count } = useCart();
  const { customer, logout } = usePortalAuth();
  const navigate = useNavigate();
  const { unreadCount, clearUnread, isAvailable, setAvailability } = useChatNotifications({
    token: getPortalToken(),
    audience: 'portal',
    enabled: Boolean(customer),
    describeMessage: useCallback(
      (message) => `New message from ${message.senderUser?.name ?? 'our sales team'}`,
      []
    ),
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/">
          <ClientLogo />
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium transition-colors',
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            aria-label={`Quote cart, ${count} item${count === 1 ? '' : 's'}`}
            className="relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ShoppingCart className="size-[18px]" aria-hidden="true" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
          {customer ? (
            <>
              <button
                type="button"
                onClick={() => setAvailability(!isAvailable)}
                title={isAvailable ? 'Set chat status to offline' : 'Set chat status to online'}
                className={cn(
                  'hidden items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:flex',
                  isAvailable
                    ? 'text-emerald-700 hover:bg-emerald-50'
                    : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {isAvailable ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                {isAvailable ? 'Online' : 'Offline'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearUnread();
                  navigate('/portal/quotations');
                }}
                title="Chat notifications"
                className="relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Bell className="size-[18px]" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <Link to="/portal/quotations">
                <Button variant="ghost" size="sm">
                  My Quotations
                </Button>
              </Link>
              <Link to="/portal/subscriptions">
                <Button variant="ghost" size="sm">
                  My Subscriptions
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Staff Login
                </Button>
              </Link>
              <Link to="/portal/login">
                <Button variant="secondary" size="sm">
                  Customer Login
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
