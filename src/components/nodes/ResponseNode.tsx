import { memo, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Bot, GitFork, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store'
import { Markdown } from '@/components/ui/Markdown'

export interface ResponseNodeData {
  content: string
  nodeId: string
  model?: string
  isStreaming?: boolean
  [key: string]: unknown
}

function ResponseNodeComponent({ data, sourcePosition, targetPosition }: NodeProps) {
  const { forkFromNode } = useChatStore()
  const nodeData = data as unknown as ResponseNodeData
  const content = nodeData.content || ''
  const nodeId = nodeData.nodeId || ''
  const model = nodeData.model
  const isStreaming = nodeData.isStreaming

  // Keep the response scrolled to the newest tokens while streaming.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isStreaming && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [content, isStreaming])

  return (
    <div className={cn(
      'group relative w-[340px] rounded-xl border border-border bg-card p-3 shadow-sm',
      'hover:border-muted-foreground/30 hover:shadow-md transition-all duration-200',
      isStreaming && 'border-primary/40 shadow-[0_0_0_1px_var(--color-primary)]'
    )}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-none"
      />

      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-medium text-muted-foreground">Assistant</p>
            {model && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                {model}
              </span>
            )}
          </div>
          <div
            ref={bodyRef}
            className="chatgraph-scroll max-h-[360px] overflow-y-auto pr-1 nowheel"
          >
            {content ? (
              <Markdown content={content} />
            ) : isStreaming ? (
              <span className="text-sm text-muted-foreground">Generating…</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Empty response</span>
            )}
            {isStreaming && content && (
              <span className="ml-0.5 inline-block h-3.5 w-[2px] -mb-0.5 animate-pulse bg-primary align-middle" />
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => forkFromNode(nodeId)}
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Fork from here"
        >
          <GitFork className="w-3 h-3" />
        </button>
        <button
          className="p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-accent"
          title="Regenerate"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-none"
      />
    </div>
  )
}

export const ResponseNode = memo(ResponseNodeComponent)
