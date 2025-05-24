// src/components/ui/button.tsx
'use client';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link' | 'solid';
  size?: 'sm' | 'default' | 'lg' | 'icon'; // Added 'default', 'lg', 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, isLoading, variant = 'default', size = 'default', ...props }, ref) => {
    
    const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background whitespace-nowrap"; // Added whitespace-nowrap

    // Variant Styles (keep these or adapt from shadcn/ui if you installed it)
    const variantStyles = {
      default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm", // Added shadow-sm
      destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
      outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800",
      secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
      ghost: "hover:bg-gray-100 hover:text-accent-foreground",
      link: "text-blue-600 underline-offset-4 hover:underline",
      solid: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm", // Solid variant for consistency
    };

    // Size Styles
    const sizeStyles = {
      sm: "h-9 px-3 py-2 text-xs", // Slightly increased padding and defined height
      default: "h-10 px-4 py-2 text-sm", // Good default size
      lg: "h-11 px-6 py-3 text-base", // Larger size
      icon: "h-10 w-10", // For icon-only buttons
    };

    return (
      <button
        className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className || ''}`}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <svg className={`animate-spin h-5 w-5 ${children ? 'mr-2' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };