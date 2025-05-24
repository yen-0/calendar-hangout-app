// src/components/ui/ConfirmationModal.tsx
'use client';

import React from 'react';
import Modal from './modal'; // Your existing generic Modal
import { Button } from './button'; // Your existing Button

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-sm text-gray-600 mb-6">{message}</div>
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant="destructive" // Or 'default' if it's not always destructive
          onClick={onConfirm}
          isLoading={isLoading}
          disabled={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;