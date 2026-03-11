import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Plus, UserCog, Trash2, Shield, User as UserIcon, LogOut, KeyRound, Pencil } from 'lucide-react';
import type { User } from '../types';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<User>) => Promise<boolean>;
    initial?: User;
}

function UserFormModal({ isOpen, onClose, onSave, initial }: UserFormModalProps) {
    const [username, setUsername] = useState(initial?.username || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<User['role']>(initial?.role || 'user');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const data: Partial<User> & { password?: string } = { username, role };
        if (password) data.password = password;
        
        const success = await onSave(data);
        setSaving(false);
        if (success) onClose();
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box bg-base-200 border border-white/10 shadow-2xl">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <UserCog size={20} className="text-secondary" />
                    {initial ? 'Edit User' : 'New User'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-control">
                        <label className="label"><span className="label-text">Username</span></label>
                        <input
                            type="text"
                            required
                            className="input input-bordered focus:input-secondary bg-base-300"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Password {initial && '(Leave blank to keep unchanged)'}</span>
                        </label>
                        <input
                            type="password"
                            required={!initial}
                            className="input input-bordered focus:input-secondary bg-base-300"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="form-control">
                        <label className="label"><span className="label-text">Role</span></label>
                        <select
                            className="select select-bordered focus:select-secondary bg-base-300"
                            value={role}
                            onChange={e => setRole(e.target.value as User['role'])}
                        >
                            <option value="user">User (Read Only)</option>
                            <option value="manager">Manager (Read & Control)</option>
                            <option value="admin">Admin (Full Access)</option>
                        </select>
                    </div>

                    <div className="modal-action mt-6">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" variant="secondary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save User'}
                        </Button>
                    </div>
                </form>
            </div>
            <div className="modal-backdrop bg-black/50" onClick={onClose} />
        </div>
    );
}

export function UsersPage() {
    const { users, loading, createUser, updateUser, deleteUser } = useUsers();
    const { user: currentUser } = useAuth();
    const [showAdd, setShowAdd] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="text-secondary" /> User Management
                    </h1>
                    <p className="text-neutral-content text-sm mt-1">
                        Control administrative access and roles across PRISM 
                    </p>
                </div>
                <Button icon={<Plus size={16} />} variant="secondary" onClick={() => setShowAdd(true)}>
                    Add User
                </Button>
            </div>

            {loading && users.length === 0 ? (
                <div className="flex items-center justify-center p-12">
                    <span className="loading loading-spinner text-secondary loading-lg"></span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.map(u => (
                        <div key={u.id} className="card bg-base-200 border border-white/5 hover:border-secondary/30 transition-colors shadow-sm relative overflow-hidden">
                            {/* Color strip indicating role */}
                            <div className={`absolute top-0 left-0 w-1 h-full ${
                                u.role === 'admin' ? 'bg-error' : 
                                u.role === 'manager' ? 'bg-warning' : 
                                'bg-success'
                            }`} />
                            
                            <div className="p-5 pl-6 flex flex-col h-full space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-base-300 border border-white/10 flex items-center justify-center shrink-0">
                                            {u.role === 'admin' ? <Shield size={18} className="text-error" /> :
                                             u.role === 'manager' ? <KeyRound size={18} className="text-warning" /> :
                                             <UserIcon size={18} className="text-success" />}
                                        </div>
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                {u.username}
                                                {u.id === currentUser?.userId && <span className="badge badge-sm badge-outline">You</span>}
                                            </div>
                                            <div className="text-xs text-neutral-content uppercase tracking-wider font-semibold mt-0.5">
                                                {u.role}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => setEditUser(u)}
                                            className="btn btn-ghost btn-square btn-sm text-neutral-content hover:text-secondary"
                                            title="Edit Role/Password"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (u.id === currentUser?.userId) {
                                                    alert("You cannot delete your own account.");
                                                    return;
                                                }
                                                if (confirm(`Are you sure you want to delete the user "${u.username}"?`)) {
                                                    deleteUser(u.id);
                                                }
                                            }}
                                            className="btn btn-ghost btn-square btn-sm text-neutral-content hover:text-error hover:bg-error/10"
                                            disabled={u.id === currentUser?.userId}
                                            title={u.id === currentUser?.userId ? "Cannot delete yourself" : "Delete User"}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="mt-auto pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-neutral-content">
                                    <LogOut size={12} />
                                    <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <UserFormModal 
                isOpen={showAdd} 
                onClose={() => setShowAdd(false)} 
                onSave={createUser} 
            />
            
            {editUser && (
                <UserFormModal 
                    isOpen={true} 
                    onClose={() => setEditUser(null)} 
                    onSave={(data) => updateUser(editUser.id, data)}
                    initial={editUser} 
                />
            )}
        </div>
    );
}
