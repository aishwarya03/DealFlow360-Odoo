import { useCallback, useEffect, useState } from 'react';
import { Bell, LogOut, Search, Wifi, WifiOff } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { getToken } from '../api/client';
import CommandPalette from '../components/CommandPalette';
import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { cn } from '../lib/cn';
import { TONE_CLASSES } from '../lib/status';
import { navForRole, ROLES } from '../lib/roles';

const CAN_TOGGLE_CHAT_PRESENCE = ['SALES_REP', 'SALES_MANAGER'];

/*
 * The internal shell — a tool, not a document (docs/DESIGN_SYSTEM.md
 * "Two shells, one system"). Persistent left nav, filtered server-truth
 * roles down to what this user can reach; violet appears only on the
 * active item and the logo, never as page-wide color.
 */
const NavSection = ({ title, items, badgeCounts = {} }) => {
  if (!items.length) return null;

  return (
    <div>
      <p className="px-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {title}
      </p>
      <div className="mt-1.5 space-y-0.5">
        {items.map(({ key, label, path, end, icon: Icon, status }) => (
          <NavLink
            key={key}
            to={path}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {status === 'soon' && (
              <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                Soon
              </span>
            )}
            {badgeCounts[key] > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
                {badgeCounts[key] > 9 ? '9+' : badgeCounts[key]}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

const AppShell = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const items = navForRole(user.role);
  const workspaceItems = items.filter((item) => item.group === 'Workspace');
  const configItems = items.filter((item) => item.group === 'Configuration');

  const canTogglePresence = CAN_TOGGLE_CHAT_PRESENCE.includes(user.role);
  const { unreadCount, clearUnread, isAvailable, setAvailability } = useChatNotifications({
    token: getToken(),
    audience: 'internal',
    enabled: CAN_TOGGLE_CHAT_PRESENCE.includes(user.role),
    describeMessage: useCallback(
      (message) => `New message from ${message.senderCustomer?.name ?? 'a customer'}`,
      []
    ),
  });

  useEffect(() => {
    if (location.pathname.startsWith('/workspace/chat')) clearUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Global hotkey Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
      />

      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <Logo />
        </div>

        <div className="p-3 pb-0">
          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100"
          >
            <div className="flex items-center gap-2">
              <Search className="size-3.5 text-slate-400" />
              <span>Search…</span>
            </div>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto p-3 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]">
          <NavSection title="Workspace" items={workspaceItems} />
          <NavSection title="Configuration" items={configItems} />
        </nav>

        <div className="border-t border-slate-200 p-3">
          {canTogglePresence && (
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAvailability(!isAvailable)}
                title={isAvailable ? 'Set chat status to offline' : 'Set chat status to online'}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                  isAvailable
                    ? 'text-emerald-700 hover:bg-emerald-50'
                    : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {isAvailable ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                <span>{isAvailable ? 'Online' : 'Offline'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  clearUnread();
                  if (!location.pathname.startsWith('/workspace/chat')) navigate('/workspace/chat');
                }}
                title="Chat notifications"
                className="relative flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
              <span
                className={cn(
                  'mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                  TONE_CLASSES[ROLES[user.role]?.tone ?? 'neutral']
                )}
              >
                {ROLES[user.role]?.label ?? user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
