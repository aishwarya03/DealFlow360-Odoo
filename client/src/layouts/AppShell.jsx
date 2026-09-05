import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';
import { TONE_CLASSES } from '../lib/status';
import { navForRole, ROLES } from '../lib/roles';

/*
 * The internal shell — a tool, not a document (docs/DESIGN_SYSTEM.md
 * "Two shells, one system"). Persistent left nav, filtered server-truth
 * roles down to what this user can reach; violet appears only on the
 * active item and the logo, never as page-wide color.
 */
const NavSection = ({ title, items }) => {
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
          </NavLink>
        ))}
      </div>
    </div>
  );
};

const AppShell = () => {
  const { user, logout } = useAuth();
  const items = navForRole(user.role);
  const workspaceItems = items.filter((item) => item.group === 'Workspace');
  const configItems = items.filter((item) => item.group === 'Configuration');

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <Logo />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <NavSection title="Workspace" items={workspaceItems} />
          <NavSection title="Configuration" items={configItems} />
        </nav>

        <div className="border-t border-slate-200 p-3">
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
