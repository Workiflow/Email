import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function KeyHint({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'rounded-md border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
