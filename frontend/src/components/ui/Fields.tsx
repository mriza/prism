import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
    return (
        <div className="form-control w-full">
            {label && (
                <label className="label py-1.5 pt-0">
                    <span className="label-text text-[10px] font-bold uppercase tracking-wider text-neutral-content">{label}</span>
                </label>
            )}
            <input
                className={twMerge(
                    clsx(
                        "input input-bordered bg-base-100 focus:input-primary transition-all duration-200",
                        className
                    )
                )}
                {...props}
            />
        </div>
    );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
    return (
        <div className="form-control w-full">
            {label && (
                <label className="label py-1.5 pt-0">
                    <span className="label-text text-[10px] font-bold uppercase tracking-wider text-neutral-content">{label}</span>
                </label>
            )}
            <select
                className={twMerge(
                    clsx(
                        "select select-bordered bg-base-100 focus:select-primary transition-all duration-200",
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
        </div>
    );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
}

export function Textarea({ label, className, ...props }: TextareaProps) {
    return (
        <div className="form-control w-full">
            {label && (
                <label className="label py-1.5 pt-0">
                    <span className="label-text text-[10px] font-bold uppercase tracking-wider text-neutral-content">{label}</span>
                </label>
            )}
            <textarea
                className={twMerge(
                    clsx(
                        "textarea textarea-bordered bg-base-100 focus:textarea-primary min-h-[5rem] transition-all duration-200",
                        className
                    )
                )}
                {...props}
            />
        </div>
    );
}

