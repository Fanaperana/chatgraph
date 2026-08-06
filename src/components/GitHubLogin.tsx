import { useState } from 'react'
import { LogOut, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { getStoredToken, storeToken, clearToken } from '@/services/auth/github'
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
  const [inputToken, setInputToken] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState('')

  const handleSaveToken = () => {
    const trimmed = inputToken.trim()
    if (!trimmed) {
      setError('Please enter a token')
      return
    }
    storeToken(trimmed)
    setToken(trimmed)
    setInputToken('')
    setShowInput(false)
    setError('')
  }

  const handleLogout = () => {
    clearToken()
    setToken(null)
    setError('')
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
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
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
          <p className="text-sm text-muted-foreground">
            Enter a GitHub Personal Access Token with <code className="px-1 py-0.5 rounded bg-card text-xs font-mono">copilot</code> scope.
          </p>

          <a
            href="https://github.com/settings/tokens/new?scopes=copilot&description=ChatGraph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Create token on GitHub <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={inputToken}
                onChange={(e) => { setInputToken(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-3 py-2 pr-9 text-sm rounded-md border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={handleSaveToken}
              className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={() => { setShowInput(false); setError('') }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
