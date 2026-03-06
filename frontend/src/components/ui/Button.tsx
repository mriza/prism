import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
    icon?: ReactNode;
    loading?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
    primary: {
        background: 'var(--color-accent)',
        color: '#fff',
        border: '1px solid transparent',
    },
    secondary: {
        background: 'var(--color-bg-elevated)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)',
    },
    ghost: {
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        border: '1px solid transparent',
    },
    danger: {
        background: 'rgba(239,68,68,0.15)',
        color: '#f87171',
        border: '1px solid rgba(239,68,68,0.3)',
    },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
    sm: { fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.35rem' },
    md: { fontSize: '0.875rem', padding: '0.5rem 1rem', gap: '0.5rem' },
    lg: { fontSize: '0.9375rem', padding: '0.625rem 1.25rem', gap: '0.5rem' },
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    icon,
    loading,
    style,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                transition: 'var(--transition)',
                opacity: disabled ? 0.5 : 1,
                ...variantStyles[variant],
                ...sizeStyles[size],
                ...style,
            }}
            onMouseEnter={e => {
                if (disabled || loading) return;
                const el = e.currentTarget;
                if (variant === 'primary') el.style.background = 'var(--color-accent-hover)';
                else if (variant === 'secondary') el.style.background = 'var(--color-bg-overlay)';
                else if (variant === 'ghost') el.style.background = 'rgba(255,255,255,0.05)';
                else if (variant === 'danger') el.style.background = 'rgba(239,68,68,0.25)';
            }}
            onMouseLeave={e => {
                const el = e.currentTarget;
                Object.assign(el.style, variantStyles[variant]);
            }}
            {...props}
        >
            {loading ? (
                <span style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
            ) : icon}
            {children}
        </button>
    );
}
