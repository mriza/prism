import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    description?: string;
}

export function Input({ label, description, className, ...props }: InputProps) {
    return (
        <div className="form-control w-full gap-1.5">
            {label && (
                <label className="flex px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-content/60">{label}</span>
                </label>
            )}
            <input
                className={twMerge(
                    clsx(
                        "input input-bordered bg-base-100/50 focus:input-primary transition-all duration-200 border-white/5 hover:border-white/10",
                        className
                    )
                )}
                {...props}
            />
            {description && (
                <div className="px-0.5">
                    <span className="text-[10px] text-neutral-content/40 italic leading-tight block">{description}</span>
                </div>
            )}
        </div>
    );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    description?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, description, options, className, ...props }: SelectProps) {
    return (
        <div className="form-control w-full gap-1.5">
            {label && (
                <label className="flex px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-content/60">{label}</span>
                </label>
            )}
            <select
                className={twMerge(
                    clsx(
                        "select select-bordered bg-base-100/50 focus:select-primary transition-all duration-200 border-white/5 hover:border-white/10",
                        className
                    )
                )}
                {...props}
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {description && (
                <div className="px-0.5">
                    <span className="text-[10px] text-neutral-content/40 italic leading-tight block">{description}</span>
                </div>
            )}
        </div>
    );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    description?: string;
}

export function Textarea({ label, description, className, ...props }: TextareaProps) {
    return (
        <div className="form-control w-full gap-1.5">
            {label && (
                <label className="flex px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-content/60">{label}</span>
                </label>
            )}
            <textarea
                className={twMerge(
                    clsx(
                        "textarea textarea-bordered bg-base-100/50 focus:textarea-primary min-h-[6rem] transition-all duration-200 border-white/5 hover:border-white/10",
                        className
                    )
                )}
                {...props}
            />
            {description && (
                <div className="px-0.5">
                    <span className="text-[10px] text-neutral-content/40 italic leading-tight block">{description}</span>
                </div>
            )}
        </div>
    );
}

