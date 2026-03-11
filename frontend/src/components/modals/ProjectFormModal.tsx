import { useState } from 'react';
import type { Project } from '../../types';
import { PROJECT_COLORS } from '../../types';
import { Modal } from '../ui/Modal';
import { Input, Textarea } from '../ui/Fields';
import { Button } from '../ui/Button';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Project, 'id' | 'createdAt'>) => void;
    initial?: Project;
}

export function ProjectFormModal({ isOpen, onClose, onSave, initial }: Props) {
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0]);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim(), description: description.trim() || undefined, color });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit Project' : 'New Project'} size="md">
            <div className="space-y-6">
                <div className="space-y-4">
                    <Input
                        label="Project Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. E-Commerce Platform"
                        autoFocus
                    />
                    <Textarea
                        label="Description (optional)"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="What is this project about?"
                        rows={3}
                    />

                    {/* Color picker */}
                    <div className="space-y-4 pt-2">
                        <label className="flex px-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-content/60">Project Color</span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {PROJECT_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{ backgroundColor: c }}
                                    className={twMerge(
                                        clsx(
                                            "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center shadow-sm",
                                            color === c ? "border-white ring-2 ring-primary ring-offset-2 ring-offset-base-100 scale-110" : "border-transparent hover:scale-105 active:scale-95"
                                        )
                                    )}
                                >
                                    {color === c && <Check size={14} className="text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <Button variant="ghost" onClick={onClose} className="hover:bg-white/5">
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={!name.trim()} className="px-6">
                        {initial ? 'Save Changes' : 'Create Project'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

