import { ArrowDownUp, ArrowRightLeft } from 'lucide-react'
import { useChatStore } from '@/store'
import { cn } from '@/lib/utils'

export function LayoutToggle() {
  const { settings, setLayoutDirection } = useChatStore()
  const isVertical = settings.layoutDirection === 'TB'

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <button
        onClick={() => setLayoutDirection(isVertical ? 'LR' : 'TB')}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-card border border-border shadow-lg',
          'text-sm text-muted-foreground hover:text-foreground',
          'hover:border-primary/30 transition-all duration-200'
        )}
      >
        {isVertical ? (
          <>
            <ArrowDownUp className="w-4 h-4" />
            <span>Top-Down</span>
          </>
        ) : (
          <>
            <ArrowRightLeft className="w-4 h-4" />
            <span>Left-Right</span>
          </>
        )}
      </button>
    </div>
  )
}
