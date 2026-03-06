import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-bg-base)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    padding: '0.5rem 0.75rem',
    transition: 'var(--transition)',
    outline: 'none',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.375rem',
};

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
    return (
        <div>
            {label && <label style={labelStyle}>{label}</label>}
            <input
                style={{ ...fieldStyle, ...style }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-subtle)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                {...props}
            />
        </div>
    );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, options, style, ...props }: SelectProps) {
    return (
        <div>
            {label && <label style={labelStyle}>{label}</label>}
            <select
                style={{ ...fieldStyle, cursor: 'pointer', ...style }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-subtle)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                {...props}
            >
                {options.map(o => (
                    <option key={o.value} value={o.value} style={{ background: 'var(--color-bg-elevated)' }}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
}

export function Textarea({ label, style, ...props }: TextareaProps) {
    return (
        <div>
            {label && <label style={labelStyle}>{label}</label>}
            <textarea
                style={{ ...fieldStyle, resize: 'vertical', minHeight: '5rem', ...style }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-subtle)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                {...props}
            />
        </div>
    );
}
