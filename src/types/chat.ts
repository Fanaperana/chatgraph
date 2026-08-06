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
  /** When true, the node body is capped and scrolls instead of growing. */
  scrollable?: boolean
  /** Artifacts extracted from this node's response (code blocks). */
  artifactIds?: string[]
}

export type ArtifactKind = 'code' | 'html' | 'svg' | 'mermaid' | 'markdown'

export interface ArtifactVersion {
  code: string
  createdAt: number
  /** Short description of how this version was produced. */
  note: string
}

export interface Artifact {
  id: string
  /** The response node this artifact was extracted from. */
  nodeId: string
  title: string
  language: string
  kind: ArtifactKind
  /** The originally generated code, used to match the block in the response. */
  originalCode: string
  versions: ArtifactVersion[]
  currentVersion: number
  createdAt: number
  updatedAt: number
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
