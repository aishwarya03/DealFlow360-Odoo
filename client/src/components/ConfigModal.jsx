import { X } from 'lucide-react';

import Button from './Button';

const ConfigModal = ({ title, children, onClose, onSubmit, isSaving }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
    <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close dialog"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        {children}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  </div>
);

export default ConfigModal;
