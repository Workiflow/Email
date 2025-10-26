import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface TagPillProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
}

export function TagPill({ color = '#1f2937', className, ...props }: TagPillProps) {
  const style = {
    backgroundColor: `${color}1A`,
    color
  } as const;
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)} style={style} {...props} />;
}
