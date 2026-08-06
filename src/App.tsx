import { useEffect } from 'react'
import { ChatFlow } from '@/components/ChatFlow'
import { useChatStore } from '@/store'

export default function App() {
  const { trees, activeTreeId, createTree, settings } = useChatStore()

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
    <div className="h-screen w-screen overflow-hidden bg-background">
      <ChatFlow />
    </div>
  )
}
