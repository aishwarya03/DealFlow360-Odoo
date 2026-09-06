import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MessageCircle,
  Repeat,
  Search,
  ShieldCheck,
  Store,
  UserCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { listProducts } from '../api/products';
import { listQuotations } from '../api/quotations';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';
import { ROLES } from '../lib/roles';

const DEMO_ROLES = [
  { email: 'admin@dealflow360.com', role: 'ADMIN', label: 'Admin' },
  { email: 'rep@dealflow360.com', role: 'SALES_REP', label: 'Sales Rep' },
  { email: 'manager@dealflow360.com', role: 'SALES_MANAGER', label: 'Sales Manager' },
  { email: 'finance@dealflow360.com', role: 'FINANCE', label: 'Finance' },
];

const STATIC_ACTIONS = [
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    subtitle: 'Workspace overview & metrics',
    icon: LayoutDashboard,
    section: 'Navigation',
    action: (nav) => nav('/workspace'),
  },
  {
    id: 'nav-quotations',
    title: 'Quotations',
    subtitle: 'Manage sales quotes & approval states',
    icon: FileText,
    section: 'Navigation',
    action: (nav) => nav('/workspace/quotations'),
  },
  {
    id: 'nav-approvals',
    title: 'Approvals Queue',
    subtitle: 'Discount requests waiting on your decision',
    icon: ShieldCheck,
    section: 'Navigation',
    action: (nav) => nav('/workspace/approvals'),
  },
  {
    id: 'nav-chat',
    title: 'Live Chat Inbox',
    subtitle: 'Customer negotiation & collaboration threads',
    icon: MessageCircle,
    section: 'Navigation',
    action: (nav) => nav('/workspace/chat'),
  },
  {
    id: 'nav-subscriptions',
    title: 'Subscriptions',
    subtitle: 'Recurring billing contracts & proration',
    icon: Repeat,
    section: 'Navigation',
    action: (nav) => nav('/workspace/subscriptions'),
  },
  {
    id: 'nav-inventory',
    title: 'Inventory & Stock',
    subtitle: 'Stock levels & reorder alerts',
    icon: Boxes,
    section: 'Navigation',
    action: (nav) => nav('/workspace/inventory'),
  },
  {
    id: 'nav-products',
    title: 'Products & Pricing',
    subtitle: 'Manage catalog & recommendations',
    icon: Boxes,
    section: 'Navigation',
    action: (nav) => nav('/workspace/products'),
  },
  {
    id: 'nav-warehouses',
    title: 'Warehouses',
    subtitle: 'Multi-warehouse facilities',
    icon: Warehouse,
    section: 'Navigation',
    action: (nav) => nav('/workspace/warehouses'),
  },
  {
    id: 'nav-customers',
    title: 'Customers',
    subtitle: 'Customer accounts & contact directory',
    icon: Users,
    section: 'Navigation',
    action: (nav) => nav('/workspace/customers'),
  },
  {
    id: 'nav-storefront',
    title: 'Public Storefront',
    subtitle: 'Customer-facing website & catalog',
    icon: Store,
    section: 'Navigation',
    action: (nav) => nav('/products'),
  },
];

const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResults, setLiveResults] = useState([]);
  const inputRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Live search debounced for quotations & products
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setLiveResults([]);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const [quotes, prods] = await Promise.all([
          listQuotations().catch(() => []),
          listProducts({ limit: 20 }).catch(() => ({ products: [] })),
        ]);

        if (cancelled) return;

        const q = query.toLowerCase();
        const matchedQuotes = (quotes || [])
          .filter(
            (item) =>
              item.code?.toLowerCase().includes(q) ||
              item.customer?.name?.toLowerCase().includes(q)
          )
          .slice(0, 4)
          .map((item) => ({
            id: `quote-${item.id}`,
            title: item.code,
            subtitle: `${item.customer?.name} · ₹${(item.totals?.grandTotal ?? 0).toLocaleString('en-IN')}`,
            icon: FileText,
            section: 'Quotations',
            action: (nav) => nav(`/workspace/quotations/${item.id}`),
          }));

        const matchedProducts = (prods?.products || [])
          .filter(
            (item) =>
              item.name?.toLowerCase().includes(q) ||
              item.sku?.toLowerCase().includes(q)
          )
          .slice(0, 4)
          .map((item) => ({
            id: `prod-${item.id}`,
            title: item.name,
            subtitle: `SKU: ${item.sku} · ₹${item.listPrice?.toLocaleString('en-IN')}`,
            icon: Boxes,
            section: 'Products',
            action: (nav) => nav('/workspace/products'),
          }));

        setLiveResults([...matchedQuotes, ...matchedProducts]);
      } catch {
        if (!cancelled) setLiveResults([]);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  const allItems = useMemo(() => {
    const roleActions = DEMO_ROLES.map((acc) => ({
      id: `role-${acc.role}`,
      title: `Switch to ${acc.label}`,
      subtitle: `Demo login as ${acc.email} (${ROLES[acc.role]?.label})`,
      icon: UserCheck,
      section: 'Quick Role Switch (Demo)',
      isCurrent: user?.role === acc.role,
      action: async () => {
        if (user?.role === acc.role) return;
        try {
          await login(acc.email, 'Password123');
          toast.success(`Switched role to ${acc.label}`);
          navigate('/workspace');
        } catch {
          toast.error('Failed to switch role');
        }
      },
    }));

    const filteredActions = STATIC_ACTIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    return [...liveResults, ...filteredActions, ...roleActions];
  }, [liveResults, query, user?.role, login, navigate]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 >= allItems.length ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 < 0 ? allItems.length - 1 : prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = allItems[selectedIndex];
        if (selected) {
          selected.action(navigate);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allItems, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:pt-24"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-fade-in"
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-zoom-in">
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-100 px-4">
          <Search className="size-4.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, quotation code, product, or role…"
            className="h-13 w-full bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {allItems.length === 0 ? (
            <div className="py-12 text-center">
              <HelpCircle className="mx-auto size-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-slate-400">Try searching for quotations, products, or sections</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      item.action(navigate);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-brand-50 text-brand-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
                        isSelected
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      <Icon className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">
                          {item.title}
                        </span>
                        {item.isCurrent && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Active
                          </span>
                        )}
                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {item.section}
                        </span>
                      </div>
                      <p className="truncate text-sm text-slate-500">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200">↑</kbd>{' '}
              <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded bg-white px-1.5 py-0.5 border border-slate-200">↵</kbd> to select
            </span>
          </div>
          <span>DealFlow360 Spotlight</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
