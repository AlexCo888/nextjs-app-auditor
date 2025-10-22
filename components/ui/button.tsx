import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant='default', size='md', isLoading=false, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed';
    const variants: Record<string, string> = {
      default: 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50',
      primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
      ghost: 'bg-transparent text-gray-900 border-transparent hover:bg-gray-100',
      destructive: 'bg-red-600 text-white border-red-600 hover:bg-red-700'
    };
    const sizes: Record<string, string> = {
      sm: 'h-8 px-3',
      md: 'h-9 px-4',
      lg: 'h-10 px-5'
    };
    return (
      <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {isLoading && <span className="mr-2 inline-block animate-pulse">…</span>}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
