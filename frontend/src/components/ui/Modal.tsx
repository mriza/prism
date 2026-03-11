import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, subtitle, icon, children, size = 'md' }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (isOpen) {
            dialogRef.current?.showModal();
        } else {
            dialogRef.current?.close();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <dialog 
            ref={dialogRef} 
            className="modal modal-bottom sm:modal-middle"
            onClose={onClose}
        >
            <div className={twMerge(
                clsx(
                    "modal-box bg-base-200 border border-white/5 p-0 overflow-hidden flex flex-col max-h-[90vh]",
                    sizeMap[size]
                )
            )}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 px-6 border-b border-white/5 bg-base-300/50">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                {icon}
                            </div>
                        )}
                        <div>
                            <h3 className="text-base font-bold text-base-content leading-tight">
                                {title}
                            </h3>
                            {subtitle && (
                                <p className="text-[10px] uppercase font-black tracking-widest text-neutral-content/40 mt-0.5">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost btn-sm btn-square text-neutral-content hover:text-base-content"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
            <form method="dialog" className="modal-backdrop bg-black/60 backdrop-blur-sm">
                <button>close</button>
            </form>
        </dialog>,
        document.body
    );
}

