import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, disabled, ...props }, ref) => {
    const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none';
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3 text-sm',
    };
    const variants = {
      primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-sm shadow-cyan-400/20',
      secondary: 'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
      ghost: 'bg-transparent text-white/60 hover:bg-white/10 hover:text-white',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/25',
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
