import { useState } from 'react';
import type { Project } from '../../types';
import { PROJECT_COLORS } from '../../types';
import { Modal } from '../ui/Modal';
import { Input, Textarea } from '../ui/Fields';
import { Button } from '../ui/Button';
import { Check } from 'lucide-react';

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                    rows={2}
                />

                {/* Color picker */}
                <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Color
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {PROJECT_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: c,
                                    border: color === c ? '2px solid #fff' : '2px solid transparent',
                                    boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'var(--transition)',
                                }}
                            >
                                {color === c && <Check size={12} color="#fff" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
                        {initial ? 'Save Changes' : 'Create Project'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
