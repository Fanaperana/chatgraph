import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitFork, Copy, CopyPlus, Pencil, Trash2, User, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store'

export interface PromptNodeData {
  content: string
  nodeId: string
  [key: string]: unknown
}

function PromptNodeComponent({ data, sourcePosition, targetPosition }: NodeProps) {
  const { forkFromNode, deleteSubtree } = useChatStore()
  const nodeData = data as unknown as PromptNodeData
  const content = nodeData.content || ''
  const nodeId = nodeData.nodeId || ''
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  // null = not editing; 'edit' updates in place; 'duplicate' spawns a sibling.
  const [editing, setEditing] = useState<null | 'edit' | 'duplicate'>(null)
  const [draft, setDraft] = useState('')
  const isLong = content.length > 160 || content.split('\n').length > 4

  const startEdit = (mode: 'edit' | 'duplicate') => {
    setDraft(content)
    setEditing(mode)
  }

  const saveEdit = () => {
    if (editing === 'edit') useChatStore.getState().updateNodeContent(nodeId, draft)
    else if (editing === 'duplicate') useChatStore.getState().duplicateWithEdit(nodeId, draft)
    setEditing(null)
  }

  return (
    <div className={cn(
      'group relative w-[300px] rounded-md border border-primary/20 bg-primary/5 px-2 pb-2 pt-1.5 shadow-sm',
      'hover:border-primary/40 hover:shadow-md transition-all duration-200'
    )}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className="!w-2 !h-2 !bg-primary/50 !border-none"
      />

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-start mb-1 gap-2">
            <div className="bg-secondary flex items-center justify-center border rounded-md">
              <User className="w-3 h-3 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">You</p>
          </div>
          {editing ? (
            <div className="nodrag nowheel">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(null)
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit()
                }}
                rows={4}
                className="w-full resize-none rounded-md border border-border bg-card p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="mt-1 flex items-center justify-end gap-1">
                <button
                  onClick={() => setEditing(null)}
                  className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="px-2 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {editing === 'duplicate' ? 'Duplicate' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p
                className={cn(
                  'text-sm text-foreground leading-relaxed whitespace-pre-wrap',
                  !expanded && 'line-clamp-4'
                )}
              >
                {content || <span className="text-muted-foreground italic">Empty prompt</span>}
              </p>
              {isLong && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" /> Show more
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            } catch {
              // Clipboard unavailable; ignore.
            }
          }}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title={copied ? 'Copied!' : 'Copy prompt'}
        >
          {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        </button>
        <button
          onClick={() => forkFromNode(nodeId)}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Fork"
        >
          <GitFork className="w-3 h-3" />
        </button>
        <button
          onClick={() => startEdit('duplicate')}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Duplicate & Edit"
        >
          <CopyPlus className="w-3 h-3" />
        </button>
        <button
          onClick={() => startEdit('edit')}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Edit in place"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={() => deleteSubtree(nodeId)}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        className="!w-2 !h-2 !bg-primary/50 !border-none"
      />
    </div>
  )
}

export const PromptNode = memo(PromptNodeComponent)
