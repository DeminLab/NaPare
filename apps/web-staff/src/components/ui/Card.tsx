'use client';

import { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8' };

export function Card({ children, className = '', hover = false, padding = 'md', ...props }: CardProps) {
  return (
    <div className={`ds-card ${hover ? 'cursor-pointer hover:border-sky-200 hover:shadow-md hover:shadow-sky-100' : ''} ${paddings[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
}
