import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'neutral';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
    icon?: ReactNode;
    loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    neutral: 'btn-neutral',
    ghost: 'btn-ghost',
    danger: 'btn-error',
    outline: 'btn-outline',
};

const sizeClasses: Record<Size, string> = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    icon,
    loading,
    className,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            className={twMerge(
                clsx(
                    'btn no-animation',
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )
            )}
            {...props}
        >
            {loading ? (
                <span className="loading loading-spinner loading-xs" />
            ) : icon}
            {children}
        </button>
    );
}

