// src/components/ui/button.tsx
'use client';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link' | 'solid';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, isLoading, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyle =
      'inline-flex items-center justify-center border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

    const variantStyles = {
      default: 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800',
      destructive: 'border-red-700 bg-red-700 text-white hover:bg-red-800',
      outline: 'border-stone-400 bg-white text-slate-800 hover:bg-stone-100',
      secondary: 'border-stone-300 bg-stone-100 text-slate-800 hover:bg-stone-200',
      ghost: 'border-transparent bg-transparent text-slate-700 hover:bg-stone-100',
      link: 'border-transparent bg-transparent text-slate-700 underline-offset-4 hover:underline',
      solid: 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800',
    };

    const sizeStyles = {
      sm: 'h-9 px-3 py-2 text-xs',
      default: 'h-10 px-4 py-2 text-sm',
      lg: 'h-11 px-6 py-3 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className || ''}`}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <svg
            className={`h-5 w-5 animate-spin ${children ? 'mr-2' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };
