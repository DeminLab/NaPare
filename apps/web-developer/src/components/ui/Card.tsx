'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'bordered';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const base = 'ds-card p-6';
    const variants = {
      default: '',
      hover: 'transition-all hover:border-[var(--workspace-accent)] hover:shadow-md cursor-pointer',
      bordered: '',
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
