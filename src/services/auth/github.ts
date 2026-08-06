// GitHub OAuth Device Flow for Copilot access
// Similar to `gh auth login --web`

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98' // GitHub CLI's public client ID (copilot-capable)

const isDev = import.meta.env.DEV

// In dev, route through the Vite proxy to bypass CORS on github.com / api.github.com.
const GITHUB_LOGIN_BASE = isDev ? '/api/github-login' : 'https://github.com'
const COPILOT_TOKEN_URL = isDev
  ? '/api/copilot-token'
  : 'https://api.github.com/copilot_internal/v2/token'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(`${GITHUB_LOGIN_BASE}/login/device/code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.statusText}`)
  }

  return response.json()
}

export async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onStatus?: (status: string) => void
): Promise<string> {
  const startTime = Date.now()
  const expiresAt = startTime + expiresIn * 1000

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000))

    const response = await fetch(`${GITHUB_LOGIN_BASE}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.access_token) {
      return data.access_token
    }

    if (data.error === 'authorization_pending') {
      onStatus?.('Waiting for authorization...')
      continue
    }

    if (data.error === 'slow_down') {
      interval += 5
      onStatus?.('Slowing down polling...')
      continue
    }

    if (data.error === 'expired_token') {
      throw new Error('Device code expired. Please try again.')
    }

    if (data.error === 'access_denied') {
      throw new Error('Authorization denied by user.')
    }

    if (data.error) {
      throw new Error(`OAuth error: ${data.error_description || data.error}`)
    }
  }

  throw new Error('Device code expired. Please try again.')
}

// Get a Copilot token using the GitHub user token
export async function getCopilotToken(githubToken: string): Promise<string> {
  const response = await fetch(COPILOT_TOKEN_URL, {
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get Copilot token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.token
}

const STORAGE_KEY = 'chatgraph-github-token'

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function storeToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}
