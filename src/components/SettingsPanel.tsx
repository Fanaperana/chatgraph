import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useChatStore } from '@/store'
import { cn } from '@/lib/utils'
import type { LLMProviderConfig, LLMProviderType } from '@/types/chat'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { providers, settings, addProvider, updateProvider, removeProvider, setTheme } = useChatStore()
  const [editingProvider, setEditingProvider] = useState<string | null>(null)

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
    setEditingProvider(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme */}
          <section>
            <h3 className="text-sm font-medium text-foreground mb-3">Theme</h3>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm capitalize transition-colors',
                    settings.theme === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* Providers */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">LLM Providers</h3>
              <button
                onClick={handleAddProvider}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            <div className="space-y-3">
              {Object.values(providers).map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isEditing={editingProvider === provider.id}
                  onEdit={() => setEditingProvider(editingProvider === provider.id ? null : provider.id)}
                  onUpdate={(updates) => updateProvider(provider.id, updates)}
                  onDelete={() => removeProvider(provider.id)}
                />
              ))}
            </div>
          </section>
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
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <button onClick={onEdit} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
          {provider.name}
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
            {provider.type}
          </span>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-3 space-y-2">
          <Field label="Name" value={provider.name} onChange={(v) => onUpdate({ name: v })} />
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={provider.type}
              onChange={(e) => onUpdate({ type: e.target.value as LLMProviderType })}
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background text-foreground"
            >
              <option value="ollama">Ollama</option>
              <option value="llamacpp">llama.cpp</option>
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="copilot">GitHub Copilot</option>
            </select>
          </div>
          <Field label="Endpoint" value={provider.endpoint} onChange={(v) => onUpdate({ endpoint: v })} />
          <Field label="API Key" value={provider.apiKey ?? ''} onChange={(v) => onUpdate({ apiKey: v || undefined })} type="password" />
          <Field label="Default Model" value={provider.defaultModel} onChange={(v) => onUpdate({ defaultModel: v })} />
          <Field
            label="Temperature"
            value={String(provider.temperature ?? 0.7)}
            onChange={(v) => onUpdate({ temperature: parseFloat(v) || 0.7 })}
          />
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}
