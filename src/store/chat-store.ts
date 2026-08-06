import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatNode, ChatTree, LLMProviderConfig, AppSettings, LayoutDirection, ChatMode } from '@/types/chat'

function generateId(): string {
  return crypto.randomUUID()
}

interface ChatState {
  trees: Record<string, ChatTree>
  activeTreeId: string | null
  providers: Record<string, LLMProviderConfig>
  settings: AppSettings

  // Tree actions
  createTree: (name?: string) => string
  deleteTree: (treeId: string) => void
  setActiveTree: (treeId: string) => void

  // Node actions
  addNode: (role: ChatNode['role'], content: string, parentId: string | null) => string
  updateNodeContent: (nodeId: string, content: string) => void
  setNodeStreaming: (nodeId: string, streaming: boolean) => void
  forkFromNode: (nodeId: string) => string
  duplicateWithEdit: (nodeId: string, newContent: string) => string
  deleteSubtree: (nodeId: string) => void

  // Get ancestor chain for context building
  getAncestorChain: (nodeId: string) => ChatNode[]

  // Provider actions
  addProvider: (provider: LLMProviderConfig) => void
  updateProvider: (id: string, updates: Partial<LLMProviderConfig>) => void
  removeProvider: (id: string) => void

  // Settings
  setLayoutDirection: (direction: LayoutDirection) => void
  setChatMode: (mode: ChatMode) => void
  setActiveProvider: (providerId: string | null) => void
  setActiveModel: (model: string | null) => void
  setThinkingEffort: (effort: AppSettings['thinkingEffort']) => void
  setMaxContextLength: (length: number) => void
  setTheme: (theme: AppSettings['theme']) => void
}

const DEFAULT_SETTINGS: AppSettings = {
  layoutDirection: 'TB',
  chatMode: 'agent',
  activeProviderId: null,
  activeModel: null,
  thinkingEffort: 'medium',
  maxContextLength: 4096,
  theme: 'dark',
}

const DEFAULT_PROVIDERS: Record<string, LLMProviderConfig> = {
  copilot: {
    id: 'copilot',
    type: 'copilot',
    name: 'GitHub Copilot',
    endpoint: 'https://api.githubcopilot.com',
    models: [],
    defaultModel: 'gpt-4o',
    temperature: 0.7,
  },
  ollama: {
    id: 'ollama',
    type: 'ollama',
    name: 'Ollama',
    endpoint: 'http://localhost:11434',
    models: [],
    defaultModel: 'llama3.2',
    temperature: 0.7,
  },
  llamacpp: {
    id: 'llamacpp',
    type: 'llamacpp',
    name: 'llama.cpp',
    endpoint: 'http://localhost:8080',
    models: ['default'],
    defaultModel: 'default',
    temperature: 0.7,
  },
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      trees: {},
      activeTreeId: null,
      providers: DEFAULT_PROVIDERS,
      settings: DEFAULT_SETTINGS,

      createTree: (name?: string) => {
        const id = generateId()
        const tree: ChatTree = {
          id,
          name: name ?? `Chat ${Object.keys(get().trees).length + 1}`,
          rootNodeId: null,
          nodes: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          trees: { ...state.trees, [id]: tree },
          activeTreeId: id,
        }))
        return id
      },

      deleteTree: (treeId) => {
        set((state) => {
          const { [treeId]: _, ...rest } = state.trees
          return {
            trees: rest,
            activeTreeId: state.activeTreeId === treeId ? null : state.activeTreeId,
          }
        })
      },

      setActiveTree: (treeId) => set({ activeTreeId: treeId }),

      addNode: (role, content, parentId) => {
        const state = get()
        const treeId = state.activeTreeId
        if (!treeId) return ''

        const nodeId = generateId()
        const node: ChatNode = {
          id: nodeId,
          role,
          content,
          parentId,
          childrenIds: [],
          createdAt: Date.now(),
          model: state.settings.activeModel ?? undefined,
          providerId: state.settings.activeProviderId ?? undefined,
        }

        set((state) => {
          const tree = state.trees[treeId]
          if (!tree) return state

          const updatedNodes = { ...tree.nodes, [nodeId]: node }

          // Update parent's children
          if (parentId && updatedNodes[parentId]) {
            updatedNodes[parentId] = {
              ...updatedNodes[parentId],
              childrenIds: [...updatedNodes[parentId].childrenIds, nodeId],
            }
          }

          return {
            trees: {
              ...state.trees,
              [treeId]: {
                ...tree,
                nodes: updatedNodes,
                rootNodeId: tree.rootNodeId ?? nodeId,
                updatedAt: Date.now(),
              },
            },
          }
        })

        return nodeId
      },

      updateNodeContent: (nodeId, content) => {
        const treeId = get().activeTreeId
        if (!treeId) return

        set((state) => {
          const tree = state.trees[treeId]
          if (!tree || !tree.nodes[nodeId]) return state

          return {
            trees: {
              ...state.trees,
              [treeId]: {
                ...tree,
                nodes: {
                  ...tree.nodes,
                  [nodeId]: { ...tree.nodes[nodeId], content },
                },
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      setNodeStreaming: (nodeId, streaming) => {
        const treeId = get().activeTreeId
        if (!treeId) return

        set((state) => {
          const tree = state.trees[treeId]
          if (!tree || !tree.nodes[nodeId]) return state

          return {
            trees: {
              ...state.trees,
              [treeId]: {
                ...tree,
                nodes: {
                  ...tree.nodes,
                  [nodeId]: { ...tree.nodes[nodeId], isStreaming: streaming },
                },
              },
            },
          }
        })
      },

      forkFromNode: (nodeId) => {
        // Creates an empty user node as sibling (same parent as nodeId)
        const state = get()
        const treeId = state.activeTreeId
        if (!treeId) return ''

        const tree = state.trees[treeId]
        if (!tree) return ''

        const targetNode = tree.nodes[nodeId]
        if (!targetNode) return ''

        return get().addNode('user', '', targetNode.parentId)
      },

      duplicateWithEdit: (nodeId, newContent) => {
        // Creates a copy of the node as sibling with new content
        const state = get()
        const treeId = state.activeTreeId
        if (!treeId) return ''

        const tree = state.trees[treeId]
        if (!tree) return ''

        const targetNode = tree.nodes[nodeId]
        if (!targetNode) return ''

        return get().addNode(targetNode.role, newContent, targetNode.parentId)
      },

      deleteSubtree: (nodeId) => {
        const treeId = get().activeTreeId
        if (!treeId) return

        set((state) => {
          const tree = state.trees[treeId]
          if (!tree) return state

          // Collect all descendant IDs
          const toDelete = new Set<string>()
          const queue = [nodeId]
          while (queue.length > 0) {
            const current = queue.pop()!
            toDelete.add(current)
            const node = tree.nodes[current]
            if (node) queue.push(...node.childrenIds)
          }

          // Remove from parent's children
          const targetNode = tree.nodes[nodeId]
          const updatedNodes = { ...tree.nodes }

          if (targetNode?.parentId && updatedNodes[targetNode.parentId]) {
            updatedNodes[targetNode.parentId] = {
              ...updatedNodes[targetNode.parentId],
              childrenIds: updatedNodes[targetNode.parentId].childrenIds.filter(
                (id) => id !== nodeId
              ),
            }
          }

          // Delete all nodes in subtree
          for (const id of toDelete) {
            delete updatedNodes[id]
          }

          return {
            trees: {
              ...state.trees,
              [treeId]: {
                ...tree,
                nodes: updatedNodes,
                rootNodeId: tree.rootNodeId === nodeId ? null : tree.rootNodeId,
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      getAncestorChain: (nodeId) => {
        const state = get()
        const treeId = state.activeTreeId
        if (!treeId) return []

        const tree = state.trees[treeId]
        if (!tree) return []

        const chain: ChatNode[] = []
        let currentId: string | null = nodeId

        while (currentId) {
          const n: ChatNode | undefined = tree.nodes[currentId]
          if (!n) break
          chain.unshift(n)
          currentId = n.parentId
        }

        return chain
      },

      addProvider: (provider) => {
        set((state) => ({
          providers: { ...state.providers, [provider.id]: provider },
        }))
      },

      updateProvider: (id, updates) => {
        set((state) => {
          const existing = state.providers[id]
          if (!existing) return state
          return {
            providers: { ...state.providers, [id]: { ...existing, ...updates } },
          }
        })
      },

      removeProvider: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.providers
          return { providers: rest }
        })
      },

      setLayoutDirection: (direction) =>
        set((state) => ({ settings: { ...state.settings, layoutDirection: direction } })),
      setChatMode: (mode) =>
        set((state) => ({ settings: { ...state.settings, chatMode: mode } })),
      setActiveProvider: (providerId) =>
        set((state) => ({ settings: { ...state.settings, activeProviderId: providerId } })),
      setActiveModel: (model) =>
        set((state) => ({ settings: { ...state.settings, activeModel: model } })),
      setThinkingEffort: (effort) =>
        set((state) => ({ settings: { ...state.settings, thinkingEffort: effort } })),
      setMaxContextLength: (length) =>
        set((state) => ({ settings: { ...state.settings, maxContextLength: length } })),
      setTheme: (theme) =>
        set((state) => ({ settings: { ...state.settings, theme } })),
    }),
    {
      name: 'chatgraph-storage',
    }
  )
)
