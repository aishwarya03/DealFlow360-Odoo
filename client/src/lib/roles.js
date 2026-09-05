import {
  BarChart3,
  Boxes,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Package,
  Receipt,
  Repeat,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

/*
 * Single source of truth for "who can see what" in the internal shell.
 * Mirrors docs/SOURCE_OF_TRUTH.md §6 (role -> access matrix) for the tabs
 * that matrix actually covers, and the brief's own role descriptions
 * (section 3) for the rest. Cross-check docs/STAFF_LOGIN.html before
 * changing a role list here — that doc is written from this file.
 */
export const ROLES = {
  ADMIN: {
    label: 'Admin',
    tone: 'neutral',
    blurb: 'Backend configuration and platform-wide reporting.',
  },
  SALES_REP: {
    label: 'Sales Rep',
    tone: 'info',
    blurb: 'Builds quotations, applies discounts, tracks their own deals.',
  },
  SALES_MANAGER: {
    label: 'Sales Manager',
    tone: 'warning',
    blurb: 'Approves discounts, configures ceilings, watches deal health.',
  },
  FINANCE: {
    label: 'Finance',
    tone: 'success',
    blurb: 'Second-level approval, fulfillment, billing and credit notes.',
  },
};

export const roleLabel = (role) => ROLES[role]?.label ?? role;

/*
 * `status: 'live'` pages call the real API built so far (Products, Customers,
 * Warehouses, Inventory — the brief's Section A "Configuration Area").
 * `status: 'soon'` pages are Section B, the rep workspace — routed and
 * visible to the right roles already, so the nav is honest about the whole
 * planned shell, but they render a placeholder until that slice is built.
 */
export const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/workspace',
    end: true,
    icon: LayoutDashboard,
    roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'],
    status: 'live',
    group: 'Workspace',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    path: '/workspace/quotations',
    icon: FileText,
    roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'approvals',
    label: 'Approvals',
    path: '/workspace/approvals',
    icon: ShieldCheck,
    // Not SALES_REP: a rep submits for approval but does not act as an approver.
    roles: ['ADMIN', 'SALES_MANAGER', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'fulfillment',
    label: 'Fulfillment',
    path: '/workspace/fulfillment',
    icon: Truck,
    roles: ['ADMIN', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    path: '/workspace/subscriptions',
    icon: Repeat,
    roles: ['ADMIN', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    path: '/workspace/invoices',
    icon: Receipt,
    roles: ['ADMIN', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'deal-health',
    label: 'Deal Health',
    path: '/workspace/deal-health',
    icon: HeartPulse,
    roles: ['ADMIN', 'SALES_MANAGER', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'reports',
    label: 'Reports',
    path: '/workspace/reports',
    icon: BarChart3,
    roles: ['ADMIN', 'SALES_MANAGER', 'FINANCE'],
    status: 'soon',
    group: 'Workspace',
  },
  {
    key: 'products',
    label: 'Products',
    path: '/workspace/products',
    icon: Package,
    roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'],
    status: 'live',
    group: 'Configuration',
  },
  {
    key: 'customers',
    label: 'Customers',
    path: '/workspace/customers',
    icon: Users,
    roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'],
    status: 'live',
    group: 'Configuration',
  },
  {
    key: 'warehouses',
    label: 'Warehouses',
    path: '/workspace/warehouses',
    icon: Warehouse,
    roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'],
    status: 'live',
    group: 'Configuration',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    path: '/workspace/inventory',
    icon: Boxes,
    roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'],
    status: 'live',
    group: 'Configuration',
  },
];

export const navForRole = (role) => NAV_ITEMS.filter((item) => item.roles.includes(role));
