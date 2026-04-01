import React from 'react';
import { AlertTriangle } from 'lucide-react';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

export function useConfirmDialog() {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const close = React.useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = React.useCallback((nextOptions: ConfirmOptions) => {
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const dialog = options ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{options.title}</h3>
        {options.description && <p className="mt-2 text-sm leading-relaxed text-gray-500">{options.description}</p>}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors ${
              options.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog: dialog };
}
