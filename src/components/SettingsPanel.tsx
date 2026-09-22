import { useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Palette,
  Server,
  ChevronDown,
  Pencil,
  Check,
} from 'lucide-react'
import { useChatStore } from '@/store'
import { cn } from '@/lib/utils'
import { GitHubLogin } from '@/components/GitHubLogin'
import type { LLMProviderConfig, LLMProviderType } from '@/types/chat'

interface SettingsPanelProps {
  onClose: () => void
}

type SettingsTab = 'appearance' | 'providers'

const TABS: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'providers', label: 'LLM Providers', icon: Server },
]

const PROVIDER_TYPE_LABELS: Record<LLMProviderType, string> = {
  ollama: 'Ollama',
  llamacpp: 'llama.cpp',
  'openai-compatible': 'OpenAI Compatible',
  copilot: 'GitHub Copilot',
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { providers, settings, addProvider, updateProvider, removeProvider, setTheme } = useChatStore()
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  const handleAddProvider = () => {
    const id = crypto.randomUUID()
    const newProvider: LLMProviderConfig = {
      id,
      type: 'openai-compatible',
      name: 'New Provider',
      endpoint: 'http://localhost:8080',
      models: [],
      defaultModel: '',
      temperature: 0.7,
    }
    addProvider(newProvider)
    setActiveTab('providers')
    setEditingProvider(id)
  }

  const providerList = Object.values(providers)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl h-[85vh] max-h-180 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className="hidden sm:flex w-56 shrink-0 flex-col border-r border-border bg-secondary/40">
          <div className="px-5 py-5">
            <h2 className="text-base font-semibold text-foreground">Settings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Configure your workspace</p>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === 'appearance'
                  ? 'Customize the look and feel of the app.'
                  : 'Manage the model providers used for chat.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'providers' && (
                <button
                  onClick={handleAddProvider}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" /> Add provider
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Mobile tabs */}
          <div className="flex gap-1 border-b border-border px-4 py-2 sm:hidden">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {activeTab === 'appearance' && (
              <section>
                <h4 className="text-sm font-medium text-foreground">Theme</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose how the interface appears.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {(
                    [
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => {
                    const active = settings.theme === value
                    return (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                          'group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-primary/40 hover:bg-accent'
                        )}
                      >
                        {active && (
                          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                        <Icon
                          className={cn(
                            'w-5 h-5',
                            active ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-medium',
                            active ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {activeTab === 'providers' && (
              <section className="space-y-3">
                {providerList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                    <Server className="w-8 h-8 text-muted-foreground/60" />
                    <p className="mt-3 text-sm font-medium text-foreground">No providers yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a provider to start chatting with a model.
                    </p>
                    <button
                      onClick={handleAddProvider}
                      className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add provider
                    </button>
                  </div>
                ) : (
                  providerList.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      isEditing={editingProvider === provider.id}
                      onEdit={() =>
                        setEditingProvider(editingProvider === provider.id ? null : provider.id)
                      }
                      onUpdate={(updates) => updateProvider(provider.id, updates)}
                      onDelete={() => {
                        removeProvider(provider.id)
                        if (editingProvider === provider.id) setEditingProvider(null)
                      }}
                    />
                  ))
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProviderCardProps {
  provider: LLMProviderConfig
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updates: Partial<LLMProviderConfig>) => void
  onDelete: () => void
}

function ProviderCard({ provider, isEditing, onEdit, onUpdate, onDelete }: ProviderCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-colors',
        isEditing ? 'border-primary/50 shadow-sm' : 'border-border hover:border-primary/30'
      )}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Server className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{provider.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {PROVIDER_TYPE_LABELS[provider.type]}
              {provider.defaultModel ? ` · ${provider.defaultModel}` : ''}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              isEditing
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Pencil className="w-3 h-3" />
            {isEditing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete provider"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              isEditing && 'rotate-180'
            )}
          />
        </div>
      </div>

      {isEditing && (
        <div className="border-t border-border p-4">
          {provider.type === 'copilot' && (
            <div className="mb-4">
              <GitHubLogin />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" value={provider.name} onChange={(v) => onUpdate({ name: v })} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={provider.type}
                onChange={(e) => onUpdate({ type: e.target.value as LLMProviderType })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ollama">Ollama</option>
                <option value="llamacpp">llama.cpp</option>
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="copilot">GitHub Copilot</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Field label="Endpoint" value={provider.endpoint} onChange={(v) => onUpdate({ endpoint: v })} />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="API Key"
                value={provider.apiKey ?? ''}
                onChange={(v) => onUpdate({ apiKey: v || undefined })}
                type="password"
                placeholder="Optional"
              />
            </div>
            <Field
              label="Default Model"
              value={provider.defaultModel}
              onChange={(v) => onUpdate({ defaultModel: v })}
            />
            <Field
              label="Temperature"
              value={String(provider.temperature ?? 0.7)}
              onChange={(v) => onUpdate({ temperature: parseFloat(v) || 0.7 })}
              type="number"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}
