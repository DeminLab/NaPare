import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, disabled, ...props }, ref) => {
    const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--workspace-focus-ring)] disabled:opacity-50 disabled:pointer-events-none';
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3 text-sm',
    };
    const variants = {
      primary: 'bg-[var(--workspace-accent)] text-slate-950 hover:bg-[var(--workspace-accent-hover)] shadow-sm shadow-cyan-400/20',
      secondary: 'border border-[var(--workspace-line)] bg-[var(--workspace-paper)] text-[var(--workspace-ink)] hover:bg-[var(--workspace-paper-muted)]',
      ghost: 'bg-transparent text-[var(--workspace-muted)] hover:bg-[var(--workspace-paper-muted)] hover:text-[var(--workspace-ink)]',
      danger: 'bg-[var(--workspace-danger)] text-slate-950 hover:brightness-110 shadow-sm shadow-red-600/25',
    };

    return (
      <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
