import { useState } from 'react'
import { LogOut, ExternalLink, Loader2, Copy, Check } from 'lucide-react'
import {
  getStoredToken,
  storeToken,
  clearToken,
  requestDeviceCode,
  pollForToken,
} from '@/services/auth/github'
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
  const [userCode, setUserCode] = useState('')
  const [verificationUri, setVerificationUri] = useState('')
  const [status, setStatus] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setError('')
    setConnecting(true)
    setStatus('Requesting device code...')
    try {
      const device = await requestDeviceCode()
      setUserCode(device.user_code)
      setVerificationUri(device.verification_uri)
      setStatus('Waiting for authorization...')

      const accessToken = await pollForToken(
        device.device_code,
        device.interval,
        device.expires_in,
        (s) => setStatus(s)
      )

      storeToken(accessToken)
      setToken(accessToken)
      setUserCode('')
      setStatus('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleLogout = () => {
    clearToken()
    setToken(null)
    setError('')
    setStatus('')
    setUserCode('')
  }

  if (token) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <GitHubIcon className="w-4 h-4 text-foreground" />
          <span className="text-sm text-foreground">Connected to GitHub</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {token.slice(0, 8)}...
          </span>
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
      {!connecting && !userCode ? (
        <button
          onClick={handleConnect}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            'bg-foreground text-background hover:bg-foreground/90'
          )}
        >
          <GitHubIcon className="w-4 h-4" />
          Connect GitHub Copilot
        </button>
      ) : (
        <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
          {userCode ? (
            <>
              <p className="text-sm text-muted-foreground">
                Enter this code at GitHub to authorize:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-card text-lg font-mono tracking-widest text-center text-foreground">
                  {userCode}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-md border border-border hover:bg-secondary transition-colors"
                  title="Copy code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <a
                href={verificationUri || 'https://github.com/login/device'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open github.com/login/device <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : null}

          {status && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {status}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {error && !connecting && !userCode && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
