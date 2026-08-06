import { useChatStore } from '@/store'
import { getProvider } from '@/services/llm/providers'
import type { ChatMessage } from '@/types/chat'

export async function sendMessage(content: string, parentId: string | null): Promise<void> {
  const store = useChatStore.getState()

  // Ensure we have an active tree
  let treeId = store.activeTreeId
  if (!treeId) {
    treeId = store.createTree()
  }

  // Create the user prompt node
  const promptNodeId = store.addNode('user', content, parentId)
  if (!promptNodeId) return

  // Get the provider
  const providerId = store.settings.activeProviderId
  if (!providerId) {
    // Create a placeholder response asking to configure a provider
    store.addNode('assistant', '⚠️ No LLM provider configured. Please set one up in Settings.', promptNodeId)
    return
  }

  const providerConfig = store.providers[providerId]
  if (!providerConfig) {
    store.addNode('assistant', '⚠️ Provider not found. Please check your settings.', promptNodeId)
    return
  }

  // Build context from ancestor chain
  const ancestorChain = store.getAncestorChain(promptNodeId)
  const messages: ChatMessage[] = ancestorChain.map((node) => ({
    role: node.role === 'user' ? 'user' : node.role === 'assistant' ? 'assistant' : 'system',
    content: node.content,
  }))

  // Truncate if exceeding max context (rough token estimation: 4 chars ≈ 1 token)
  const maxTokens = store.settings.maxContextLength
  let totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  while (totalChars > maxTokens * 4 && messages.length > 1) {
    const removed = messages.shift()!
    totalChars -= removed.content.length
  }

  // Create response node (empty, will stream into it)
  const responseNodeId = store.addNode('assistant', '', promptNodeId)
  if (!responseNodeId) return

  store.setNodeStreaming(responseNodeId, true)

  try {
    const provider = getProvider(providerConfig.type)
    let fullContent = ''

    for await (const chunk of provider.chat(messages, providerConfig)) {
      fullContent += chunk
      store.updateNodeContent(responseNodeId, fullContent)
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    store.updateNodeContent(responseNodeId, `❌ Error: ${errMsg}`)
  } finally {
    store.setNodeStreaming(responseNodeId, false)
  }
}

export async function regenerateResponse(responseNodeId: string): Promise<void> {
  const store = useChatStore.getState()
  const treeId = store.activeTreeId
  if (!treeId) return

  const tree = store.trees[treeId]
  if (!tree) return

  const responseNode = tree.nodes[responseNodeId]
  if (!responseNode || responseNode.role !== 'assistant') return

  const parentId = responseNode.parentId
  if (!parentId) return

  // Delete old response subtree
  store.deleteSubtree(responseNodeId)

  // Re-send the parent prompt
  const parentNode = tree.nodes[parentId]
  if (!parentNode) return

  // Build context from the parent's ancestor chain
  const ancestorChain = store.getAncestorChain(parentId)
  const messages: ChatMessage[] = ancestorChain.map((node) => ({
    role: node.role === 'user' ? 'user' : node.role === 'assistant' ? 'assistant' : 'system',
    content: node.content,
  }))

  const providerId = store.settings.activeProviderId
  if (!providerId) return

  const providerConfig = store.providers[providerId]
  if (!providerConfig) return

  const newResponseId = store.addNode('assistant', '', parentId)
  if (!newResponseId) return

  store.setNodeStreaming(newResponseId, true)

  try {
    const provider = getProvider(providerConfig.type)
    let fullContent = ''

    for await (const chunk of provider.chat(messages, providerConfig)) {
      fullContent += chunk
      store.updateNodeContent(newResponseId, fullContent)
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    store.updateNodeContent(newResponseId, `❌ Error: ${errMsg}`)
  } finally {
    store.setNodeStreaming(newResponseId, false)
  }
}
