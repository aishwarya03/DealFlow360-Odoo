import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import Button from './Button';
import { cn } from '../lib/cn';

const TONE_CONFIG = {
  danger: {
    icon: AlertCircle,
    iconBg: 'bg-red-50 text-red-600',
    buttonVariant: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 text-amber-600',
    buttonVariant: 'warning',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50 text-emerald-600',
    buttonVariant: 'success',
  },
  primary: {
    icon: HelpCircle,
    iconBg: 'bg-brand-50 text-brand-600',
    buttonVariant: 'primary',
  },
};

/**
 * Modern modal dialog replacing window.confirm().
 */
const ConfirmDialog = ({
  isOpen = false,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const config = TONE_CONFIG[tone] || TONE_CONFIG.primary;
  const Icon = config.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={isLoading ? undefined : onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-zoom-in">
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              config.iconBg
            )}
          >
            <Icon className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {message && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.buttonVariant}
            size="sm"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
