import { useState } from 'react';
import { Server } from 'lucide-react';
import { useAgents } from '../../hooks/useAgents';

interface ApproveServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    hostname: string;
}

export function ApproveServerModal({ isOpen, onClose, agentId, hostname }: ApproveServerModalProps) {
    const { approveAgent } = useAgents();
    const [name, setName] = useState(hostname);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            setError('Server name is required');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const success = await approveAgent(agentId, name.trim(), description.trim());
            if (success) {
                onClose();
            } else {
                setError('Failed to approve server. Please try again.');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during approval');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal modal-open bg-base-300/80 backdrop-blur-sm z-50">
            <div className="modal-box border border-white/10 bg-base-200 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
                >
                    ✕
                </button>
                
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                    <Server size={20} className="text-success" />
                    Approve and Register Server
                </h3>
                
                <p className="text-sm text-neutral-content mb-6">
                    A new PRISM agent was detected on <span className="font-mono bg-base-300 px-1 py-0.5 rounded text-secondary">{hostname}</span>. 
                    Please provide a name and optional description to register it as a managed server.
                </p>

                {error && (
                    <div className="alert alert-error text-sm py-2 mb-4">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-semibold">Server Name <span className="text-error">*</span></span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Production Database"
                            className="input input-bordered w-full bg-base-300 focus:border-primary"
                            autoFocus
                        />
                    </div>
                    
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-semibold">Description</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional details about this server's purpose..."
                            className="textarea textarea-bordered h-24 bg-base-300 focus:border-primary"
                        />
                    </div>
                    
                    <div className="modal-action mt-6">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-success" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <><span className="loading loading-spinner text-success-content"></span> Approving...</>
                            ) : (
                                'Approve Server'
                            )}
                        </button>
                    </div>
                </form>
            </div>
            <form method="dialog" className="modal-backdrop" onClick={onClose}>
                <button>close</button>
            </form>
        </div>
    );
}
