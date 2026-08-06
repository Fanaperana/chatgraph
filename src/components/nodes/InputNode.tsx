import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Plus, Send, Brain, Settings2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store'
import { sendMessage } from '@/services/chat-service'

export interface InputNodeData {
  parentNodeId: string | null
  [key: string]: unknown
}

function InputNodeComponent({ data, targetPosition }: NodeProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { settings } = useChatStore()
  const nodeData = data as unknown as InputNodeData
  const parentNodeId = nodeData.parentNodeId

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await sendMessage(content.trim(), parentNodeId)
      setContent('')
    } finally {
      setIsSubmitting(false)
    }
  }, [content, parentNodeId, isSubmitting])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <div className={cn(
      'w-[380px] rounded-2xl border border-border bg-card shadow-lg',
      'hover:border-primary/30 transition-all duration-200'
    )}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className="!w-2 !h-2 !bg-primary/50 !border-none"
      />

      {/* Toolbar row */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-border/50">
        <button
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Add context"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Brain className="w-3 h-3" />
          <span className="capitalize">{settings.chatMode}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors font-mono">
          <span>{settings.activeModel ?? 'Select model'}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary capitalize">
            {settings.thinkingEffort}
          </span>
          <button
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none min-h-[24px] max-h-[120px]'
          )}
          style={{ height: 'auto', overflow: 'hidden' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = target.scrollHeight + 'px'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className={cn(
            'p-2 rounded-lg transition-all duration-200',
            content.trim()
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-secondary text-muted-foreground'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export const InputNode = memo(InputNodeComponent)
