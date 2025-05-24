// src/lib/toasts.ts
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