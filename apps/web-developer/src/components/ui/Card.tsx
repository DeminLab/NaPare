'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'bordered';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const base = 'rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100';
    const variants = {
      default: '',
      hover: 'transition-all hover:shadow-md hover:ring-slate-200 cursor-pointer',
      bordered: 'border border-slate-200',
    };

    return (
      <div ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
