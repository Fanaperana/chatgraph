import type { ChatMessage, LLMProviderConfig } from '@/types/chat'
import { getStoredToken } from '@/services/auth/github'

const isDev = import.meta.env.DEV

// In dev, use Vite proxy to avoid CORS. In prod, requests go direct.
function getProxiedUrl(endpoint: string, providerType: string): string {
  if (!isDev) return endpoint
  if (providerType === 'ollama') return '/api/ollama'
  if (providerType === 'llamacpp') return '/api/llamacpp'
  return endpoint
}

export interface LLMProvider {
  chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string, void, unknown>
  listModels(config: LLMProviderConfig): Promise<string[]>
}

export class OllamaProvider implements LLMProvider {
  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    const baseUrl = getProxiedUrl(config.endpoint, 'ollama')
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.defaultModel,
        messages,
        stream: true,
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens ?? -1,
        },
      }),
    })

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          if (json.message?.content) {
            yield json.message.content
          }
        } catch {
          // skip invalid JSON lines
        }
      }
    }
  }

  async listModels(config: LLMProviderConfig): Promise<string[]> {
    try {
      const baseUrl = getProxiedUrl(config.endpoint, 'ollama')
      const response = await fetch(`${baseUrl}/api/tags`)
      if (!response.ok) return []
      const data = await response.json()
      return data.models?.map((m: { name: string }) => m.name) ?? []
    } catch {
      return []
    }
  }
}

export class LlamaCppProvider implements LLMProvider {
  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    const baseUrl = getProxiedUrl(config.endpoint, 'llamacpp')
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? -1,
      }),
    })

    if (!response.ok) throw new Error(`llama.cpp error: ${response.statusText}`)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip
        }
      }
    }
  }

  async listModels(_config: LLMProviderConfig): Promise<string[]> {
    try {
      const baseUrl = getProxiedUrl(_config.endpoint, 'llamacpp')
      const response = await fetch(`${baseUrl}/v1/models`)
      if (!response.ok) return []
      const data = await response.json()
      return data.data?.map((m: { id: string }) => m.id) ?? []
    } catch {
      return []
    }
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

    const response = await fetch(`${config.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.defaultModel,
        messages,
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) throw new Error(`API error: ${response.statusText}`)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip
        }
      }
    }
  }

  async listModels(config: LLMProviderConfig): Promise<string[]> {
    try {
      const headers: Record<string, string> = {}
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
      const response = await fetch(`${config.endpoint}/v1/models`, { headers })
      if (!response.ok) return []
      const data = await response.json()
      return data.data?.map((m: { id: string }) => m.id) ?? []
    } catch {
      return []
    }
  }
}

export class CopilotProvider implements LLMProvider {
  // Cache the short-lived Copilot token exchanged from the GitHub token.
  private static copilotToken: string | null = null
  private static copilotTokenExpiry = 0

  private static get tokenExchangeUrl(): string {
    return isDev ? '/api/copilot-token' : 'https://api.github.com/copilot_internal/v2/token'
  }

  private static get apiBaseUrl(): string {
    return isDev ? '/api/copilot' : 'https://api.githubcopilot.com'
  }

  private static copilotHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Editor-Version': 'vscode/1.99.0',
      'Editor-Plugin-Version': 'copilot-chat/0.26.0',
      'Copilot-Integration-Id': 'vscode-chat',
      'Openai-Intent': 'conversation-panel',
    }
  }

  private static async getCopilotToken(githubToken: string): Promise<string> {
    const now = Date.now()
    if (CopilotProvider.copilotToken && now < CopilotProvider.copilotTokenExpiry - 60_000) {
      return CopilotProvider.copilotToken
    }

    const response = await fetch(CopilotProvider.tokenExchangeUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/json',
        'Editor-Version': 'vscode/1.99.0',
        'Editor-Plugin-Version': 'copilot-chat/0.26.0',
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Failed to get Copilot token (${response.status}). ` +
        `Ensure your GitHub account has an active Copilot subscription. ${body}`
      )
    }

    const data = await response.json()
    if (!data.token) throw new Error('Copilot token response missing token')
    CopilotProvider.copilotToken = data.token
    // expires_at is a unix timestamp in seconds
    CopilotProvider.copilotTokenExpiry = (data.expires_at ? data.expires_at * 1000 : now + 25 * 60_000)
    return data.token
  }

  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    const githubToken = config.apiKey || getStoredToken()
    if (!githubToken) throw new Error('Not signed in to GitHub. Please connect via Settings.')

    const copilotToken = await CopilotProvider.getCopilotToken(githubToken)

    const response = await fetch(`${CopilotProvider.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: CopilotProvider.copilotHeaders(copilotToken),
      body: JSON.stringify({
        model: config.defaultModel || 'gpt-4o',
        messages,
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`Copilot API error (${response.status}): ${errBody || response.statusText}`)
    }
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip
        }
      }
    }
  }

  async listModels(config: LLMProviderConfig): Promise<string[]> {
    const githubToken = config.apiKey || getStoredToken()
    if (!githubToken) return config.models

    try {
      const copilotToken = await CopilotProvider.getCopilotToken(githubToken)
      const response = await fetch(`${CopilotProvider.apiBaseUrl}/models`, {
        headers: CopilotProvider.copilotHeaders(copilotToken),
      })
      if (!response.ok) return config.models
      const data = await response.json()
      // Copilot API returns { data: [{ id: "model-name" }, ...] }
      if (Array.isArray(data.data)) {
        // Deduplicate model ids
        const ids = data.data.map((m: { id: string }) => m.id).filter(Boolean)
        return Array.from(new Set(ids))
      }
      return config.models
    } catch {
      return config.models
    }
  }
}

export function getProvider(type: string): LLMProvider {
  switch (type) {
    case 'ollama': return new OllamaProvider()
    case 'llamacpp': return new LlamaCppProvider()
    case 'openai-compatible': return new OpenAICompatibleProvider()
    case 'copilot': return new CopilotProvider()
    default: throw new Error(`Unknown provider type: ${type}`)
  }
}
