// src/components/ui/label.tsx
'use client';
import React from 'react';

// You can use a more specific type if you use a library like Radix UI Primitives
// For now, React.LabelHTMLAttributes is fine for a basic component.
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        // Basic styling, enhance with Tailwind or use a UI library's Label
        className={`block text-sm font-medium text-gray-700 mb-1 ${className || ''}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };