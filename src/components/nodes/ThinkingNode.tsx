import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Brain, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ThinkingNodeData {
  phase?: 'thinking' | 'responding' | 'done'
  reasoning?: string
  streaming?: boolean
  [key: string]: unknown
}

function ThinkingNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as ThinkingNodeData
  const phase = nodeData.phase ?? 'thinking'
  const reasoning = typeof nodeData.reasoning === 'string' ? nodeData.reasoning : ''
  const streaming = !!nodeData.streaming
  const hasReasoning = reasoning.trim() !== ''

  const [seconds, setSeconds] = useState(0)
  const startRef = useRef(Date.now())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!streaming) return
    const t = setInterval(
      () => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)),
      250
    )
    return () => clearInterval(t)
  }, [streaming])

  const label =
    phase === 'thinking'
      ? 'Thinking'
      : phase === 'responding'
        ? hasReasoning
          ? 'Reasoning'
          : 'Generating'
        : 'Thought process'

  const Icon = phase === 'responding' && !hasReasoning ? Sparkles : Brain

  // Show the reasoning live while streaming; keep it collapsible once done.
  const showPanel = hasReasoning && (open || (streaming && phase !== 'thinking'))

  return (
    <div
      className={cn(
        'rounded-xl border border-primary/30 bg-primary/5 shadow-sm ring-1 ring-primary/10',
        'min-w-[190px] max-w-[380px]'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-primary/50 !border-none"
      />

      <button
        type="button"
        onClick={() => hasReasoning && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-left',
          hasReasoning ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <Icon className={cn('w-3.5 h-3.5 text-primary', streaming && 'animate-pulse')} />
        <span className="text-xs font-medium text-primary">{label}</span>

        {streaming && (
          <span className="inline-flex items-center gap-0.5">
            <span className="h-1 w-1 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1 w-1 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1 w-1 rounded-full bg-primary/70 animate-bounce" />
          </span>
        )}

        {streaming && (
          <span className="text-[10px] text-muted-foreground tabular-nums">{seconds}s</span>
        )}

        {hasReasoning && !streaming && (
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
      </button>

      {showPanel && (
        <div className="nodrag nowheel max-h-56 overflow-auto border-t border-primary/20 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-muted-foreground">
            {reasoning}
          </pre>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-primary/50 !border-none"
      />
    </div>
  )
}

export const ThinkingNode = memo(ThinkingNodeComponent)
