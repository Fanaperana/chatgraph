export type LayoutDirection = 'TB' | 'LR'

export type ChatMode = 'agent' | 'ask' | 'plan'

export type NodeRole = 'user' | 'assistant' | 'system'

export interface ChatNode {
  id: string
  role: NodeRole
  content: string
  parentId: string | null
  childrenIds: string[]
  createdAt: number
  model?: string
  providerId?: string
  isStreaming?: boolean
}

export interface ChatTree {
  id: string
  name: string
  rootNodeId: string | null
  nodes: Record<string, ChatNode>
  createdAt: number
  updatedAt: number
}

export type LLMProviderType = 'ollama' | 'copilot' | 'llamacpp' | 'openai-compatible'

export interface LLMProviderConfig {
  id: string
  type: LLMProviderType
  name: string
  endpoint: string
  apiKey?: string
  models: string[]
  defaultModel: string
  temperature?: number
  maxTokens?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AppSettings {
  layoutDirection: LayoutDirection
  chatMode: ChatMode
  activeProviderId: string | null
  activeModel: string | null
  thinkingEffort: 'low' | 'medium' | 'high'
  maxContextLength: number
  theme: 'light' | 'dark' | 'system'
}
