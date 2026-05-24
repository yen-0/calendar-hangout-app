// src/lib/toasts.ts
import React from 'react';
import { toast, TypeOptions } from 'react-toastify';

interface ToastOptions {
  type?: TypeOptions; // 'info', 'success', 'warning', 'error', 'default'
  autoClose?: number | false;
  // Add other react-toastify options if needed
}

export const showToast = (message: string, options?: ToastOptions) => {
  const type = options?.type || 'default';
  toast(message, {
    type: type,
    position: "bottom-right", // Consistent with ToastContainer or override per toast
    autoClose: options?.autoClose !== undefined ? options.autoClose : 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "light", // Or "dark" / "colored"
  });
};

// Specific helpers if you like
export const showSuccessToast = (message: string, autoClose?: number | false) => {
  showToast(message, { type: 'success', autoClose });
};

export const showErrorToast = (message: string, autoClose?: number | false) => {
  showToast(message, { type: 'error', autoClose });
};

export const showInfoToast = (message: string, autoClose?: number | false) => {
    showToast(message, { type: 'info', autoClose });
};

export const showWarningToast = (message: string, autoClose?: number | false) => {
    showToast(message, { type: 'warning', autoClose });
};

/**
 * Toast with an inline action button (e.g. "Undo"). The action button dismisses
 * the toast after invoking onAction. autoClose defaults to 6s so the user has
 * time to react without being blocked.
 */
export const showActionToast = (
    message: string,
    actionLabel: string,
    onAction: () => void,
    autoClose: number | false = 6000,
) => {
    toast(
        ({ closeToast }) =>
            React.createElement(
                'div',
                { className: 'flex items-center gap-3' },
                React.createElement('span', { className: 'flex-1' }, message),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () => {
                            onAction();
                            closeToast?.();
                        },
                        className:
                            'text-sm font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2',
                    },
                    actionLabel,
                ),
            ),
        {
            type: 'default',
            position: 'bottom-right',
            autoClose,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            theme: 'light',
        },
    );
};