import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitFork, Copy, Pencil, Trash2, User } from 'lucide-react'
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

  return (
    <div className={cn(
      'group relative w-[300px] rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-sm',
      'hover:border-primary/40 hover:shadow-md transition-all duration-200'
    )}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className="!w-2 !h-2 !bg-primary/50 !border-none"
      />

      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-1">You</p>
          <p className="text-sm text-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
            {content || <span className="text-muted-foreground italic">Empty prompt</span>}
          </p>
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
