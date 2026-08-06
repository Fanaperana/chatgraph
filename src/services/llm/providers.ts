import type { ChatMessage, LLMProviderConfig } from '@/types/chat'

export interface LLMProvider {
  chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string, void, unknown>
  listModels(config: LLMProviderConfig): Promise<string[]>
}

export class OllamaProvider implements LLMProvider {
  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    const response = await fetch(`${config.endpoint}/api/chat`, {
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
      const response = await fetch(`${config.endpoint}/api/tags`)
      if (!response.ok) return config.models
      const data = await response.json()
      return data.models?.map((m: { name: string }) => m.name) ?? []
    } catch {
      return config.models
    }
  }
}

export class LlamaCppProvider implements LLMProvider {
  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    // llama.cpp server uses OpenAI-compatible endpoint
    const response = await fetch(`${config.endpoint}/v1/chat/completions`, {
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

  async listModels(config: LLMProviderConfig): Promise<string[]> {
    return config.models
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
      if (!response.ok) return config.models
      const data = await response.json()
      return data.data?.map((m: { id: string }) => m.id) ?? config.models
    } catch {
      return config.models
    }
  }
}

export class CopilotProvider implements LLMProvider {
  async *chat(messages: ChatMessage[], config: LLMProviderConfig): AsyncGenerator<string> {
    if (!config.apiKey) throw new Error('GitHub token required. Please configure in settings.')

    // GitHub Copilot uses the models API
    const response = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Editor-Version': 'chatgraph/1.0.0',
      },
      body: JSON.stringify({
        model: config.defaultModel || 'gpt-4o',
        messages,
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) throw new Error(`Copilot error: ${response.statusText}`)
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
    return ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'o3-mini']
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
