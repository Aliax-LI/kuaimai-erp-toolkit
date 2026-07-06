import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-beige bg-cream-white px-3 text-sm text-charcoal',
        'focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/20',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
