import { useState } from 'react';
import type { ServiceAccount, ServiceType } from '../../types';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../../types';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Fields';
import { Button } from '../ui/Button';
import { ServiceTypeIcon } from '../ui/ServiceTypeIcon';
import { ChevronLeft } from 'lucide-react';
import { useAgents } from '../../hooks/useAgents';

type AccountDraft = Omit<ServiceAccount, 'id' | 'createdAt'>;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: AccountDraft) => void;
    projectId?: string;
    initial?: ServiceAccount;
}

const defaultDraft = (projectId?: string): AccountDraft => ({
    type: 'mysql',
    projectId,
    agentId: '',
    name: '',
    host: 'localhost',
    port: undefined,
    database: '',
    username: '',
    password: '',
    role: '',
    targetEntity: '',
    vhost: '/',
    endpoint: '',
    accessKey: '',
    secretKey: '',
    bucket: '',
    rootPath: '/home',
    appName: '',
    script: '',
    cwd: '',
    tags: [],
});

const DEFAULT_PORTS: Partial<Record<ServiceType, number>> = {
    mysql: 3306,
    postgresql: 5432,
    mongodb: 27017,
    rabbitmq: 5672,
    'mqtt-mosquitto': 1883,
    'ftp-vsftpd': 21,
    'ftp-sftpgo': 22,
    'web-caddy': 80,
    'web-nginx': 80,
    'security-crowdsec': 8080,
};

export function AccountFormModal({ isOpen, onClose, onSave, projectId, initial }: Props) {
    const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
    const [draft, setDraft] = useState<AccountDraft>(initial ?? defaultDraft(projectId));
    const { agents } = useAgents();

    const set = (key: keyof AccountDraft, value: unknown) =>
        setDraft(d => ({ ...d, [key]: value }));

    const selectType = (t: ServiceType) => {
        setDraft(d => ({ ...d, type: t, port: DEFAULT_PORTS[t] }));
        setStep(2);
    };

    const handleSave = () => {
        if (!draft.name.trim() || !draft.agentId) return;
        onSave(draft);
        onClose();
    };

    const agentOptions = [
        { value: '', label: '— Select agent —' },
        ...agents.map(a => ({ value: a.id, label: a.id })),
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initial ? 'Edit Account' : step === 1 ? 'Select Service Type' : `Add ${SERVICE_TYPE_LABELS[draft.type]} Account`}
            size="lg"
        >
            {step === 1 ? (
                /* Step 1: Service type picker */
                <div className="space-y-8 py-2">
                    {Object.entries(SERVICE_TYPE_CATEGORIES).map(([category, types]) => (
                        <div key={category} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-white/5" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-content/40 whitespace-nowrap">
                                    {category}
                                </span>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {types.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => selectType(t)}
                                        className="btn btn-ghost bg-base-300 border border-white/5 hover:border-primary/40 hover:bg-primary/5 h-auto py-4 flex flex-col items-center gap-3 transition-all duration-200 group"
                                    >
                                        <div className="p-2 rounded-xl bg-base-100 group-hover:bg-primary/20 transition-colors">
                                            <ServiceTypeIcon type={t} size={32} />
                                        </div>
                                        <span className="text-xs font-bold tracking-tight">{SERVICE_TYPE_LABELS[t]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Step 2: Account details */
                <div className="space-y-6">
                    {!initial && (
                        <button
                            onClick={() => setStep(1)}
                            className="btn btn-ghost btn-xs gap-1 -ml-2 text-neutral-content hover:text-primary transition-colors font-medium"
                        >
                            <ChevronLeft size={14} />
                            Back to service types
                        </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Common fields */}
                        <div className="md:col-span-2">
                            <Input label="Display Name" value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. main-db" autoFocus />
                        </div>
                        <Select
                            label="Agent (Server)"
                            value={draft.agentId}
                            onChange={e => set('agentId', e.target.value)}
                            options={agentOptions}
                        />
                        {draft.projectId !== undefined ? (
                            <Input label="Project ID" value={draft.projectId ?? ''} readOnly className="bg-base-300/50 text-neutral-content/60" />
                        ) : (
                            <div className="hidden md:block" />
                        )}

                        <div className="md:col-span-2 h-px bg-white/5 my-2" />

                        {/* DB fields */}
                        {(['mongodb', 'mysql', 'postgresql'] as ServiceType[]).includes(draft.type) && (
                            <>
                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                    </div>
                                    <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} placeholder={String(DEFAULT_PORTS[draft.type])} />
                                </div>
                                <div className="md:col-span-2">
                                    <Input label="Database" value={draft.database ?? ''} onChange={e => set('database', e.target.value)} placeholder="my_database" />
                                </div>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />

                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <Select
                                        label="Privileges / Role"
                                        value={draft.role || (draft.type === 'mongodb' ? 'readWrite' : 'ALL PRIVILEGES')}
                                        onChange={e => set('role', e.target.value)}
                                        options={draft.type === 'mongodb'
                                            ? [
                                                { value: 'readWrite', label: 'readWrite (Default)' },
                                                { value: 'read', label: 'read (Read Only)' },
                                                { value: 'dbAdmin', label: 'dbAdmin' }
                                            ]
                                            : [
                                                { value: 'ALL PRIVILEGES', label: 'ALL PRIVILEGES (Default)' },
                                                { value: 'SELECT', label: 'SELECT (Read Only)' },
                                                { value: 'SELECT, INSERT, UPDATE, DELETE', label: 'Read/Write (DML only)' }
                                            ]
                                        }
                                    />
                                    <Input
                                        label="Target Table/Collection (Optional)"
                                        value={draft.targetEntity ?? ''}
                                        onChange={e => set('targetEntity', e.target.value)}
                                        placeholder={draft.type === 'mongodb' ? "e.g. users (all db if empty)" : "e.g. users (all if empty)"}
                                    />
                                </div>
                            </>
                        )}

                        {/* RabbitMQ fields */}
                        {draft.type === 'rabbitmq' && (
                            <>
                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                    </div>
                                    <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} placeholder="5672" />
                                </div>
                                <div className="md:col-span-2">
                                    <Input label="VHost" value={draft.vhost ?? ''} onChange={e => set('vhost', e.target.value)} placeholder="/" />
                                </div>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />
                            </>
                        )}

                        {/* S3 fields */}
                        {(['s3-minio', 's3-garage'] as ServiceType[]).includes(draft.type) && (
                            <>
                                <div className="md:col-span-2">
                                    <Input label="Endpoint" value={draft.endpoint ?? ''} onChange={e => set('endpoint', e.target.value)} placeholder="https://minio.example.com" />
                                </div>
                                <div className="md:col-span-2">
                                    <Input label="Bucket" value={draft.bucket ?? ''} onChange={e => set('bucket', e.target.value)} placeholder="my-bucket" />
                                </div>
                                <Input label="Access Key" value={draft.accessKey ?? ''} onChange={e => set('accessKey', e.target.value)} />
                                <Input label="Secret Key" type="password" value={draft.secretKey ?? ''} onChange={e => set('secretKey', e.target.value)} />
                            </>
                        )}

                        {/* FTP fields */}
                        {(['ftp-vsftpd', 'ftp-sftpgo'] as ServiceType[]).includes(draft.type) && (
                            <>
                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                    </div>
                                    <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} placeholder={String(DEFAULT_PORTS[draft.type])} />
                                </div>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />
                                <div className="md:col-span-2">
                                    <Input label="Root Path" value={draft.rootPath ?? ''} onChange={e => set('rootPath', e.target.value)} placeholder="/home/user" />
                                </div>
                            </>
                        )}

                        {/* MQTT Mosquitto fields */}
                        {draft.type === 'mqtt-mosquitto' && (
                            <>
                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                    </div>
                                    <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} placeholder={String(DEFAULT_PORTS[draft.type])} />
                                </div>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />
                            </>
                        )}

                        {/* Web Server fields */}
                        {(['web-caddy', 'web-nginx'] as ServiceType[]).includes(draft.type) && (
                            <>
                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                    </div>
                                    <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} placeholder={String(DEFAULT_PORTS[draft.type])} />
                                </div>
                                <div className="md:col-span-2">
                                    <Input label="Primary Domain (Endpoint)" value={draft.endpoint ?? ''} onChange={e => set('endpoint', e.target.value)} placeholder="example.com" />
                                </div>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} placeholder="(Optional) Basic Auth User" />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} placeholder="(Optional) Basic Auth Pass" />
                            </>
                        )}

                        {/* Process Manager fields */}
                        {(['pm2', 'supervisor', 'systemd'] as ServiceType[]).includes(draft.type) && (
                            <>
                                <div className="md:col-span-2 space-y-4">
                                    <Input label="App Name" value={draft.appName ?? ''} onChange={e => set('appName', e.target.value)} placeholder="my-app" />
                                    <Input label="Script" value={draft.script ?? ''} onChange={e => set('script', e.target.value)} placeholder="index.js" />
                                    <Input label="Working Directory (cwd)" value={draft.cwd ?? ''} onChange={e => set('cwd', e.target.value)} placeholder="/var/www/my-app" />

                                    <div className="p-4 rounded-xl bg-base-300/30 border border-white/5 space-y-4 pt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-3 bg-primary rounded-full" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-content/60">Port & Reverse Proxy</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="App Listen Port"
                                                type="number"
                                                value={(draft as { pm2Port?: number }).pm2Port ?? ''}
                                                onChange={e => set('pm2Port' as keyof typeof draft, Number(e.target.value) || undefined)}
                                                placeholder="3000"
                                            />
                                            <Select
                                                label="Reverse Proxy"
                                                value={(draft as { pm2ProxyType?: string }).pm2ProxyType ?? 'none'}
                                                onChange={e => set('pm2ProxyType' as keyof typeof draft, e.target.value)}
                                                options={[
                                                    { value: 'none', label: 'None' },
                                                    { value: 'caddy', label: 'Caddy' },
                                                    { value: 'nginx', label: 'Nginx' },
                                                ]}
                                            />
                                        </div>
                                        {(draft as { pm2ProxyType?: string }).pm2ProxyType && (draft as { pm2ProxyType?: string }).pm2ProxyType !== 'none' && (
                                            <div className="space-y-3 animate-fade-in">
                                                <Input
                                                    label="Domain"
                                                    value={(draft as { pm2ProxyDomain?: string }).pm2ProxyDomain ?? ''}
                                                    onChange={e => set('pm2ProxyDomain' as keyof typeof draft, e.target.value)}
                                                    placeholder="myapp.example.com"
                                                />
                                                <div className="bg-black/40 rounded-lg p-3 border border-white/5 font-mono text-[11px] leading-relaxed">
                                                    <div className="text-[10px] text-neutral-content/40 mb-2 uppercase tracking-tight">Configuration Snippet</div>
                                                    <pre className="text-info/80 overflow-auto max-h-32">
                                                        {(draft as { pm2ProxyType?: string }).pm2ProxyType === 'caddy'
                                                            ? `${(draft as { pm2ProxyDomain?: string }).pm2ProxyDomain || 'yourdomain.com'} {\n  reverse_proxy localhost:${(draft as { pm2Port?: number }).pm2Port || 3000}\n}`
                                                            : `server {\n  server_name ${(draft as { pm2ProxyDomain?: string }).pm2ProxyDomain || 'yourdomain.com'};\n  location / {\n    proxy_pass http://localhost:${(draft as { pm2Port?: number }).pm2Port || 3000};\n  }\n}`
                                                        }
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                        <Button variant="ghost" onClick={onClose} className="hover:bg-white/5">Cancel</Button>
                        <Button variant="primary" onClick={handleSave} disabled={!draft.name.trim() || !draft.agentId} className="px-6">
                            {initial ? 'Save Changes' : 'Add Account'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

