import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitFork, Copy, Pencil, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react'
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
  const isLong = content.length > 160 || content.split('\n').length > 4

  return (
    <div className={cn(
      'group relative w-[300px] rounded-md border border-primary/20 bg-primary/5 px-2 pb-2 pt-1 shadow-sm',
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
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => forkFromNode(nodeId)}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Fork"
        >
          <GitFork className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            const newContent = prompt('Edit prompt:', content)
            if (newContent !== null) {
              useChatStore.getState().duplicateWithEdit(nodeId, newContent)
            }
          }}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Duplicate & Edit"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            const newContent = prompt('Edit prompt:', content)
            if (newContent !== null) {
              useChatStore.getState().updateNodeContent(nodeId, newContent)
            }
          }}
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
