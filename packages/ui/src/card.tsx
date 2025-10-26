import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('rounded-md border border-gray-200 bg-white shadow-sm', className)} {...props} />;
}

export function CardHeader({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('border-b border-gray-200 px-4 py-2 text-sm font-semibold', className)} {...props} />;
}

export function CardContent({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('px-4 py-3 text-sm text-gray-700', className)} {...props} />;
}
