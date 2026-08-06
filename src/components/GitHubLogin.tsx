import { useState } from 'react'
import { LogOut, Loader2, Copy, ExternalLink } from 'lucide-react'
import { requestDeviceCode, pollForToken, getStoredToken, storeToken, clearToken } from '@/services/auth/github'
import { cn } from '@/lib/utils'

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

export function GitHubLogin() {
  const [token, setToken] = useState<string | null>(getStoredToken())
  const [deviceCode, setDeviceCode] = useState<{ user_code: string; verification_uri: string } | null>(null)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    setStatus('Requesting device code...')
    try {
      const codeResponse = await requestDeviceCode()
      setDeviceCode({
        user_code: codeResponse.user_code,
        verification_uri: codeResponse.verification_uri,
      })
      setStatus('Enter the code on GitHub')

      // Open GitHub in a new tab
      window.open(codeResponse.verification_uri, '_blank')

      // Poll for the token
      const accessToken = await pollForToken(
        codeResponse.device_code,
        codeResponse.interval,
        codeResponse.expires_in,
        setStatus
      )

      storeToken(accessToken)
      setToken(accessToken)
      setDeviceCode(null)
      setStatus('Connected!')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    clearToken()
    setToken(null)
    setStatus('')
    setDeviceCode(null)
  }

  const handleCopyCode = () => {
    if (deviceCode?.user_code) {
      navigator.clipboard.writeText(deviceCode.user_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (token) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <GitHubIcon className="w-4 h-4 text-foreground" />
          <span className="text-sm text-foreground">Connected to GitHub</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Logout
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!deviceCode ? (
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            'bg-foreground text-background hover:bg-foreground/90',
            isLoading && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GitHubIcon className="w-4 h-4" />
          )}
          Sign in with GitHub
        </button>
      ) : (
        <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Enter this code on GitHub:
          </p>
          <div className="flex items-center justify-center gap-2">
            <code className="px-4 py-2 text-lg font-mono font-bold tracking-widest bg-card rounded-md border border-border">
              {deviceCode.user_code}
            </code>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors"
              title="Copy code"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && <p className="text-xs text-center text-primary">Copied!</p>}
          <a
            href={deviceCode.verification_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
          >
            Open GitHub <ExternalLink className="w-3 h-3" />
          </a>
          {status && (
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {status}
            </p>
          )}
        </div>
      )}
      {status && !deviceCode && !isLoading && (
        <p className="text-xs text-center text-muted-foreground">{status}</p>
      )}
    </div>
  )
}
