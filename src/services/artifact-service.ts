import { useChatStore } from '@/store'
import { getProvider } from '@/services/llm/providers'
import type { ChatMessage } from '@/types/chat'

export interface ImproveOptions {
  artifactId: string
  instruction: string
  /** Optional selected element (HTML/SVG) the user wants to focus on. */
  selection?: string
  /** Streamed partial code callback for live editor updates. */
  onProgress?: (partialCode: string) => void
}

/** Strip a leading/trailing markdown code fence if the model wrapped the code. */
function unwrapCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```[\w+-]*\n([\s\S]*?)\n```$/)
  if (fenced) return fenced[1]
  return trimmed
}

/**
 * Ask the active LLM to improve the artifact's current code given an
 * instruction (and optionally a selected element), then append the result as
 * a new version.
 */
export async function improveArtifact(opts: ImproveOptions): Promise<void> {
  const { artifactId, instruction, selection, onProgress } = opts
  const store = useChatStore.getState()
  const artifact = store.artifacts[artifactId]
  if (!artifact) return

  const providerId = store.settings.activeProviderId
  if (!providerId) throw new Error('No provider configured')
  const providerConfig = store.providers[providerId]
  if (!providerConfig) throw new Error('Provider not found')

  const effectiveConfig = {
    ...providerConfig,
    defaultModel: store.settings.activeModel ?? providerConfig.defaultModel,
  }

  const currentCode = artifact.versions[artifact.currentVersion].code

  const selectionBlock = selection
    ? `\n\nThe user selected this specific element to focus on:\n\`\`\`\n${selection}\n\`\`\``
    : ''

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are an expert developer improving a code artifact. Return ONLY the complete, updated code with no explanations and no markdown fences. Preserve the original language and structure unless the instruction says otherwise.',
    },
    {
      role: 'user',
      content: `Here is the current ${artifact.language || 'code'} artifact:\n\n\`\`\`${artifact.language}\n${currentCode}\n\`\`\`${selectionBlock}\n\nInstruction: ${instruction}\n\nReturn the full updated code only.`,
    },
  ]

  const provider = getProvider(effectiveConfig.type)
  let full = ''
  for await (const chunk of provider.chat(messages, effectiveConfig)) {
    full += chunk
    if (onProgress) onProgress(unwrapCodeFence(full))
  }

  const finalCode = unwrapCodeFence(full)
  if (finalCode.trim().length === 0) return

  const note = selection ? `Improved (selection): ${instruction}` : `Improved: ${instruction}`
  useChatStore.getState().addArtifactVersion(artifactId, finalCode, note.slice(0, 80))
}
