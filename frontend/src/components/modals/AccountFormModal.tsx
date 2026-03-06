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
    'ftp-vsftpd': 21,
    'ftp-sftpgo': 22,
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {Object.entries(SERVICE_TYPE_CATEGORIES).map(([category, types]) => (
                        <div key={category}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                                {category}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                                {types.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => selectType(t)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.625rem',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg-elevated)',
                                            color: 'var(--color-text-primary)',
                                            cursor: 'pointer',
                                            transition: 'var(--transition)',
                                            fontFamily: 'inherit',
                                            fontSize: '0.825rem',
                                            fontWeight: 500,
                                            textAlign: 'left',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget).style.borderColor = 'var(--color-accent)';
                                            (e.currentTarget).style.background = 'var(--color-accent-subtle)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget).style.borderColor = 'var(--color-border)';
                                            (e.currentTarget).style.background = 'var(--color-bg-elevated)';
                                        }}
                                    >
                                        <ServiceTypeIcon type={t} size={28} />
                                        {SERVICE_TYPE_LABELS[t]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Step 2: Account details */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {!initial && (
                        <button
                            onClick={() => setStep(1)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                fontSize: '0.8rem',
                                color: 'var(--color-text-secondary)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                padding: 0,
                                marginBottom: '0.25rem',
                            }}
                        >
                            <ChevronLeft size={14} />
                            Change type
                        </button>
                    )}

                    {/* Common fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <Input label="Display Name" value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. main-db" autoFocus />
                        </div>
                        <Select
                            label="Agent (Server)"
                            value={draft.agentId}
                            onChange={e => set('agentId', e.target.value)}
                            options={agentOptions}
                        />
                        {draft.projectId !== undefined && (
                            <Input label="Project ID" value={draft.projectId ?? ''} readOnly style={{ opacity: 0.6 }} />
                        )}
                    </div>

                    {/* DB fields */}
                    {(['mongodb', 'mysql', 'postgresql'] as ServiceType[]).includes(draft.type) && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                                <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} style={{ width: '90px' }} />
                            </div>
                            <Input label="Database" value={draft.database ?? ''} onChange={e => set('database', e.target.value)} placeholder="my_database" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />
                            </div>
                        </>
                    )}

                    {/* RabbitMQ fields */}
                    {draft.type === 'rabbitmq' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                                <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} style={{ width: '90px' }} />
                            </div>
                            <Input label="VHost" value={draft.vhost ?? ''} onChange={e => set('vhost', e.target.value)} placeholder="/" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />
                            </div>
                        </>
                    )}

                    {/* S3 fields */}
                    {(['s3-minio', 's3-garage'] as ServiceType[]).includes(draft.type) && (
                        <>
                            <Input label="Endpoint" value={draft.endpoint ?? ''} onChange={e => set('endpoint', e.target.value)} placeholder="https://minio.example.com" />
                            <Input label="Bucket" value={draft.bucket ?? ''} onChange={e => set('bucket', e.target.value)} placeholder="my-bucket" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <Input label="Access Key" value={draft.accessKey ?? ''} onChange={e => set('accessKey', e.target.value)} />
                                <Input label="Secret Key" type="password" value={draft.secretKey ?? ''} onChange={e => set('secretKey', e.target.value)} />
                            </div>
                        </>
                    )}

                    {/* FTP fields */}
                    {(['ftp-vsftpd', 'ftp-sftpgo'] as ServiceType[]).includes(draft.type) && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                                <Input label="Host" value={draft.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="localhost" />
                                <Input label="Port" type="number" value={draft.port ?? ''} onChange={e => set('port', Number(e.target.value) || undefined)} style={{ width: '90px' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <Input label="Username" value={draft.username ?? ''} onChange={e => set('username', e.target.value)} />
                                <Input label="Password" type="password" value={draft.password ?? ''} onChange={e => set('password', e.target.value)} />
                            </div>
                            <Input label="Root Path" value={draft.rootPath ?? ''} onChange={e => set('rootPath', e.target.value)} placeholder="/home/user" />
                        </>
                    )}

                    {/* PM2 fields */}
                    {draft.type === 'pm2' && (
                        <>
                            <Input label="App Name" value={draft.appName ?? ''} onChange={e => set('appName', e.target.value)} placeholder="my-app" />
                            <Input label="Script" value={draft.script ?? ''} onChange={e => set('script', e.target.value)} placeholder="index.js" />
                            <Input label="Working Directory (cwd)" value={draft.cwd ?? ''} onChange={e => set('cwd', e.target.value)} placeholder="/var/www/my-app" />

                            {/* Port & Reverse Proxy section */}
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                                    Port & Reverse Proxy
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <Input
                                            label="Domain (for reverse proxy)"
                                            value={(draft as { pm2ProxyDomain?: string }).pm2ProxyDomain ?? ''}
                                            onChange={e => set('pm2ProxyDomain' as keyof typeof draft, e.target.value)}
                                            placeholder="myapp.example.com"
                                        />
                                        <div style={{ marginTop: '0.5rem', padding: '0.625rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
                                                {(draft as { pm2ProxyType?: string }).pm2ProxyType === 'caddy' ? 'Caddyfile snippet' : 'Nginx snippet'}
                                            </div>
                                            <pre style={{ fontSize: '0.7rem', color: '#a5f3fc', margin: 0, overflow: 'auto' }}>
                                                {(draft as { pm2ProxyType?: string }).pm2ProxyType === 'caddy'
                                                    ? `${(draft as { pm2ProxyDomain?: string }).pm2ProxyDomain || 'yourdomain.com'} {\n  reverse_proxy localhost:${(draft as { pm2Port?: number }).pm2Port || 3000}\n}`
                                                    : `server {\n  server_name ${(draft as { pm2ProxyDomain?: string }).pm2ProxyDomain || 'yourdomain.com'};\n  location / {\n    proxy_pass http://localhost:${(draft as { pm2Port?: number }).pm2Port || 3000};\n  }\n}`
                                                }
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave} disabled={!draft.name.trim() || !draft.agentId}>
                            {initial ? 'Save Changes' : 'Add Account'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
