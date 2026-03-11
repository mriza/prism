import { useState } from 'react';
import type { ServiceAccount, ServiceType } from '../../types';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../../types';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Fields';
import { Button } from '../ui/Button';
import { ServiceTypeIcon } from '../ui/ServiceTypeIcon';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
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
    databases: [],
    username: '',
    password: '',
    role: '',
    targetEntity: '',
    vhost: '/',
    bindings: [],
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

const SERVICE_NAME_MAP: Partial<Record<ServiceType, string[]>> = {
    mongodb: ['mongodb', 'mongod'],
    mysql: ['mysql', 'mariadb'],
    postgresql: ['postgresql', 'postgres'],
    rabbitmq: ['rabbitmq'],
    'mqtt-mosquitto': ['mosquitto'],
    's3-minio': ['minio'],
    's3-garage': ['garage'],
    'ftp-vsftpd': ['vsftpd'],
    'ftp-sftpgo': ['sftpgo'],
    'web-caddy': ['caddy'],
    'web-nginx': ['nginx'],
    pm2: ['pm2'],
    supervisor: ['supervisor'],
    systemd: ['systemd'],
    'security-crowdsec': ['crowdsec'],
};

export function AccountFormModal({ isOpen, onClose, onSave, projectId, initial }: Props) {
    const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
    const [draft, setDraft] = useState<AccountDraft>(initial ?? defaultDraft(projectId));
    const { agents } = useAgents();

    const set = (key: keyof AccountDraft, value: unknown) =>
        setDraft(d => ({ ...d, [key]: value }));

    const getMatchingAgents = (type: ServiceType) => {
        const names = SERVICE_NAME_MAP[type] || [];
        return agents.filter(a => 
            (a.status === 'approved' || a.status === 'online' || a.status === 'offline') &&
            a.services.some(s => names.includes(s.name))
        );
    };

    const selectType = (t: ServiceType) => {
        const matches = getMatchingAgents(t);
        const autoAgent = matches.length === 1 ? matches[0] : null;

        setDraft(d => ({ 
            ...d, 
            type: t, 
            port: DEFAULT_PORTS[t],
            agentId: autoAgent ? autoAgent.id : '',
            host: autoAgent ? (autoAgent.hostname || 'localhost') : 'localhost'
        }));
        setStep(2);
    };

    const handleSave = () => {
        if (!draft.name.trim() || !draft.agentId) return;
        onSave(draft);
        onClose();
    };

    const matchingAgents = getMatchingAgents(draft.type);

    const agentOptions = [
        { value: '', label: matchingAgents.length === 0 ? 'No compatible servers found' : '— Select Service Instance —' },
        ...matchingAgents.map(a => ({ 
            value: a.id, 
            label: `${SERVICE_TYPE_LABELS[draft.type]} on ${a.name || a.id} (${a.hostname})` 
        })),
    ];

    const handleAgentChange = (agentId: string) => {
        const agent = agents.find(a => a.id === agentId);
        if (agent) {
            setDraft(d => ({ 
                ...d, 
                agentId,
                host: agent.hostname || 'localhost',
                port: d.port || DEFAULT_PORTS[d.type]
            }));
        } else {
            set('agentId', agentId);
        }
    };

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
                            label="Service Instance"
                            value={draft.agentId}
                            onChange={e => handleAgentChange(e.target.value)}
                            options={agentOptions}
                            description={matchingAgents.length === 0 
                                ? `No compatible ${SERVICE_TYPE_LABELS[draft.type]} servers were found.` 
                                : matchingAgents.length === 1 
                                    ? `Automatically selected the only compatible server found.`
                                    : `Multiple servers found running ${SERVICE_TYPE_LABELS[draft.type]}. Please select one.`}
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
                                <div className="md:col-span-2 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-neutral-content/60 uppercase tracking-wider">Databases</label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary transition-all"
                                            onClick={() => {
                                                const dbs = draft.databases || [];
                                                set('databases', [...dbs, '']);
                                            }}
                                        >
                                            <Plus size={12} /> Add Database
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {(draft.databases && draft.databases.length > 0) ? draft.databases.map((db, idx) => (
                                            <div key={idx} className="flex gap-2 animate-slide-in">
                                                <div className="flex-1">
                                                    <Input 
                                                        value={db} 
                                                        onChange={e => {
                                                            const newDbs = [...(draft.databases || [])];
                                                            newDbs[idx] = e.target.value;
                                                            set('databases', newDbs);
                                                            // Also set primary 'database' for compatibility with older parts
                                                            if (idx === 0) set('database', e.target.value);
                                                        }} 
                                                        placeholder="database_name" 
                                                    />
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    className="px-2 text-error/60 hover:text-error hover:bg-error/10"
                                                    onClick={() => {
                                                        const newDbs = draft.databases?.filter((_, i) => i !== idx);
                                                        set('databases', newDbs);
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        )) : (
                                            <div className="text-xs text-neutral-content/40 py-4 text-center border border-dashed border-white/5 rounded-xl bg-base-300/20">
                                                No databases defined. Click "Add Database" to start.
                                            </div>
                                        )}
                                    </div>
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
                                    <Input 
                                        label="VHost" 
                                        value={draft.vhost ?? ''} 
                                        onChange={e => set('vhost', e.target.value)} 
                                        placeholder="/" 
                                        description="Virtual Host name. Multiple accounts can share the same VHost with different users."
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-4 mt-2">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <label className="text-[10px] font-bold text-neutral-content/40 uppercase tracking-[0.15em]">MQTT/Queue Bindings</label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-[10px] px-3 gap-1.5 hover:bg-primary/20 hover:text-primary transition-all border border-white/5 hover:border-primary/30"
                                            onClick={() => {
                                                const bindings = draft.bindings || [];
                                                set('bindings', [...bindings, { vhost: draft.vhost || '/', sourceExchange: 'amq.topic', destinationQueue: '', routingKey: '' }]);
                                            }}
                                        >
                                            <Plus size={12} strokeWidth={3} /> Add Binding
                                        </Button>
                                    </div>
                                    <div className="space-y-6">
                                        {(draft.bindings && draft.bindings.length > 0) ? draft.bindings.map((b, idx) => (
                                            <div key={idx} className="p-6 rounded-2xl bg-base-300/40 border border-white/5 space-y-5 animate-slide-in relative group hover:border-primary/20 transition-all">
                                                <button 
                                                    onClick={() => {
                                                        const newB = draft.bindings?.filter((_, i) => i !== idx);
                                                        set('bindings', newB);
                                                    }}
                                                    className="absolute top-2 right-2 p-1 text-neutral-content/20 hover:text-error transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Input 
                                                        label="VHost" 
                                                        value={b.vhost} 
                                                        onChange={e => {
                                                            const newB = [...(draft.bindings || [])];
                                                            newB[idx] = { ...newB[idx], vhost: e.target.value };
                                                            set('bindings', newB);
                                                        }} 
                                                    />
                                                    <Input 
                                                        label="Exchange" 
                                                        value={b.sourceExchange} 
                                                        onChange={e => {
                                                            const newB = [...(draft.bindings || [])];
                                                            newB[idx] = { ...newB[idx], sourceExchange: e.target.value };
                                                            set('bindings', newB);
                                                        }} 
                                                    />
                                                    <Input 
                                                        label="Queue" 
                                                        value={b.destinationQueue} 
                                                        onChange={e => {
                                                            const newB = [...(draft.bindings || [])];
                                                            newB[idx] = { ...newB[idx], destinationQueue: e.target.value };
                                                            set('bindings', newB);
                                                        }} 
                                                    />
                                                    <Input 
                                                        label="Routing Key" 
                                                        value={b.routingKey} 
                                                        onChange={e => {
                                                            const newB = [...(draft.bindings || [])];
                                                            newB[idx] = { ...newB[idx], routingKey: e.target.value };
                                                            set('bindings', newB);
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-xs text-neutral-content/40 py-4 text-center border border-dashed border-white/5 rounded-xl bg-base-300/20">
                                                No bindings defined. Useful for MQTT-to-Queue routing.
                                            </div>
                                        )}
                                    </div>
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
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <Input label="Quota (MB)" type="number" value={draft.quota ?? ''} onChange={e => set('quota', Number(e.target.value) || undefined)} placeholder="1024" disabled={!draft.quotaEnabled} />
                                    <div className="flex items-end pb-2">
                                        <label className="label cursor-pointer justify-start gap-3">
                                            <input 
                                                type="checkbox" 
                                                className="checkbox checkbox-primary" 
                                                checked={draft.quotaEnabled ?? false} 
                                                onChange={e => set('quotaEnabled', e.target.checked)} 
                                            />
                                            <span className="label-text">Enable Quota</span>
                                        </label>
                                    </div>
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

