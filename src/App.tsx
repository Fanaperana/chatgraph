import { useEffect, lazy, Suspense } from 'react'
import { ChatFlow } from '@/components/ChatFlow'
import { useChatStore } from '@/store'

const ArtifactPanel = lazy(() =>
  import('@/components/artifacts/ArtifactPanel').then((m) => ({ default: m.ArtifactPanel }))
)

export default function App() {
  const { trees, activeTreeId, createTree, settings } = useChatStore()
  const openArtifactId = useChatStore((s) => s.openArtifactId)

  // Auto-create a tree if none exists
  useEffect(() => {
    if (Object.keys(trees).length === 0) {
      createTree('New Chat')
    } else if (!activeTreeId) {
      const firstId = Object.keys(trees)[0]
      if (firstId) useChatStore.getState().setActiveTree(firstId)
    }
  }, [trees, activeTreeId, createTree])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else if (settings.theme === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    }
  }, [settings.theme])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <ChatFlow />
      {openArtifactId && (
        <Suspense fallback={null}>
          <ArtifactPanel />
        </Suspense>
      )}
    </div>
  )
}
