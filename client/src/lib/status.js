/*
 * The single source of truth for every state in the app.
 *
 * Five tones, no more. When a new state appears, map it into an existing tone
 * rather than adding a sixth — see docs/DESIGN_SYSTEM.md. Never pick a status
 * color at the call site; always go through StatusBadge.
 */

export const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  success: 'bg-green-50 text-green-700 ring-green-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

export const TONE_DOT = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export const TONE_TEXT = {
  neutral: 'text-slate-600',
  info: 'text-blue-600',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

export const STATUS = {
  // Quotation lifecycle
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'info' },
  UNDER_NEGOTIATION: { label: 'Under Negotiation', tone: 'info' },
  APPROVED: { label: 'Approved', tone: 'success' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  RETURNED: { label: 'Returned for Revision', tone: 'warning' },
  REJECTED: { label: 'Rejected', tone: 'danger' },

  // Blended risk band
  LOW: { label: 'Low Risk', tone: 'success' },
  MEDIUM: { label: 'Medium Risk', tone: 'warning' },
  HIGH: { label: 'High Risk', tone: 'danger' },

  // Per-line discount check
  OK: { label: 'OK', tone: 'success' },
  OVER: { label: 'Over', tone: 'danger' },

  // Approval routing
  AUTO_APPROVED: { label: 'Auto Approved', tone: 'success' },
  STEP_ACTIVE: { label: 'In Review', tone: 'info' },
  STEP_PENDING: { label: 'Not Started', tone: 'neutral' },

  // Fulfillment
  SPLIT_PENDING: { label: 'Split Pending', tone: 'info' },
  BACKORDER: { label: 'Backorder', tone: 'warning' },
  COMPLETE: { label: 'Complete', tone: 'success' },

  // Subscription
  ACTIVE: { label: 'Active', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },

  // Invoice
  PAID: { label: 'Paid', tone: 'success' },
  UNPAID: { label: 'Unpaid', tone: 'warning' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },

  // Deal health
  STALLED: { label: 'Stalled', tone: 'warning' },
  SLIPPAGE: { label: 'Delivery Slippage', tone: 'warning' },
  ANOMALY: { label: 'Discount Anomaly', tone: 'danger' },
};

/** Falls back to a neutral badge so an unmapped state degrades instead of crashing. */
export const resolveStatus = (status) =>
  STATUS[status] ?? { label: String(status ?? '—'), tone: 'neutral' };
