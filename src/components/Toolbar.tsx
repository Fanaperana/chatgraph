import { useState } from 'react'
import { Plus, Settings2, Download, Upload, FolderTree, ArrowDownUp, ArrowRightLeft, AlignCenter } from 'lucide-react'
import { useChatStore } from '@/store'
import { cn } from '@/lib/utils'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface ToolbarProps {
  onSnapToLayout?: () => void
  isDragged?: boolean
}

export function Toolbar({ onSnapToLayout, isDragged }: ToolbarProps) {
  const { trees, activeTreeId, createTree, setActiveTree, settings, setLayoutDirection } = useChatStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showTreeList, setShowTreeList] = useState(false)

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
                <button
                  key={tree.id}
                  onClick={() => { setActiveTree(tree.id); setShowTreeList(false) }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    tree.id === activeTreeId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                  )}
                >
                  {tree.name}
                </button>
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
