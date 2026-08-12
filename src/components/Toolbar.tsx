import { useState } from 'react'
import { Plus, Settings2, Download, Upload, FolderTree, ArrowDownUp, ArrowRightLeft, AlignCenter, Trash2, Boxes, Code2, FileCode, Braces } from 'lucide-react'
import { useChatStore } from '@/store'
import { cn } from '@/lib/utils'
import { languageLabel } from '@/utils/artifacts'
import type { Artifact } from '@/types/chat'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

function artifactIcon(artifact: Artifact) {
  switch (artifact.kind) {
    case 'html':
    case 'svg':
      return <FileCode className="w-4 h-4" />
    case 'mermaid':
      return <Braces className="w-4 h-4" />
    default:
      return <Code2 className="w-4 h-4" />
  }
}

interface ToolbarProps {
  onSnapToLayout?: () => void
  isDragged?: boolean
}

export function Toolbar({ onSnapToLayout, isDragged }: ToolbarProps) {
  const { trees, activeTreeId, createTree, setActiveTree, deleteTree, settings, setLayoutDirection } = useChatStore()
  const artifacts = useChatStore((s) => s.artifacts)
  const setOpenArtifact = useChatStore((s) => s.setOpenArtifact)
  const [showSettings, setShowSettings] = useState(false)
  const [showTreeList, setShowTreeList] = useState(false)
  const [showArtifacts, setShowArtifacts] = useState(false)

  const activeTree = activeTreeId ? trees[activeTreeId] : undefined
  const treeArtifacts = Object.values(artifacts)
    .filter((a) => activeTree?.nodes?.[a.nodeId])
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const handleExport = () => {
    const state = useChatStore.getState()
    const data = {
      trees: state.trees,
      providers: state.providers,
      settings: state.settings,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chatgraph-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.trees) {
          const store = useChatStore.getState()
          for (const [id, tree] of Object.entries(data.trees)) {
            if (!store.trees[id]) {
              useChatStore.setState((state) => ({
                trees: { ...state.trees, [id]: tree as typeof state.trees[string] },
              }))
            }
          }
        }
      } catch {
        alert('Invalid JSON file')
      }
    }
    input.click()
  }

  return (
    <>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {/* Tree selector */}
        <div className="relative">
          <button
            onClick={() => setShowTreeList(!showTreeList)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              'bg-card border border-border shadow-lg',
              'text-sm text-foreground hover:border-primary/30 transition-all'
            )}
          >
            <FolderTree className="w-4 h-4 text-muted-foreground" />
            <span className="max-w-[120px] truncate">
              {activeTreeId ? trees[activeTreeId]?.name ?? 'Untitled' : 'No chat'}
            </span>
          </button>

          {showTreeList && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-card shadow-xl p-1 max-h-64 overflow-y-auto">
              {Object.values(trees).map((tree) => (
                <div
                  key={tree.id}
                  className={cn(
                    'flex items-center gap-1 rounded-md text-sm transition-colors',
                    tree.id === activeTreeId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                  )}
                >
                  <button
                    onClick={() => { setActiveTree(tree.id); setShowTreeList(false) }}
                    className="flex-1 text-left px-3 py-2 truncate"
                  >
                    {tree.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete "${tree.name}"?`)) {
                        deleteTree(tree.id)
                      }
                    }}
                    className="p-1.5 mr-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {Object.keys(trees).length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No chats yet</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => createTree()}
          className="p-2 rounded-lg bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Right side actions */}
      <TooltipProvider delayDuration={200}>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLayoutDirection(settings.layoutDirection === 'TB' ? 'LR' : 'TB')}
                className="p-2 rounded-lg bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {settings.layoutDirection === 'TB' ? (
                  <ArrowDownUp className="w-4 h-4" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {settings.layoutDirection === 'TB' ? 'Switch to Left-Right' : 'Switch to Top-Down'}
            </TooltipContent>
          </Tooltip>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowArtifacts((v) => !v)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-2 py-2 rounded-lg bg-card border shadow-lg transition-all',
                    showArtifacts
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                  )}
                >
                  <Boxes className="w-4 h-4" />
                  {treeArtifacts.length > 0 && (
                    <span className="text-xs font-medium tabular-nums">{treeArtifacts.length}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Artifacts</TooltipContent>
            </Tooltip>

            {showArtifacts && (
              <div className="absolute top-full right-0 mt-1 w-72 rounded-lg border border-border bg-card shadow-xl p-1 max-h-80 overflow-y-auto">
                {treeArtifacts.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No artifacts yet</p>
                )}
                {treeArtifacts.map((artifact) => {
                  const code = artifact.versions[artifact.currentVersion]?.code ?? ''
                  const lineCount = code.split('\n').length
                  return (
                    <button
                      key={artifact.id}
                      onClick={() => { setOpenArtifact(artifact.id); setShowArtifacts(false) }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {artifactIcon(artifact)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{artifact.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {languageLabel(artifact.language)} · {lineCount} lines · v{artifact.currentVersion + 1}/{artifact.versions.length}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSnapToLayout}
                className={cn(
                  'p-2 rounded-lg bg-card border shadow-lg transition-all',
                  isDragged
                    ? 'border-primary text-primary hover:bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                )}
              >
                <AlignCenter className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Auto-layout</TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleExport}
                className="p-2 rounded-lg bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Export chat</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleImport}
                className="p-2 rounded-lg bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                <Upload className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Import chat</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}
