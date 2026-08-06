import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import type { Extension } from '@codemirror/state'
import {
  X,
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Save,
  MousePointerClick,
  Sparkles,
  Loader2,
  History,
  Trash2,
} from 'lucide-react'
import { useChatStore } from '@/store'
import { languageLabel } from '@/utils/artifacts'
import { improveArtifact } from '@/services/artifact-service'
import { Markdown } from '@/components/ui/Markdown'
import { cn } from '@/lib/utils'

const EXT_MAP: Record<string, string> = {
  javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx',
  python: 'py', py: 'py', html: 'html', htm: 'html', css: 'css', json: 'json',
  markdown: 'md', md: 'md', svg: 'svg', mermaid: 'mmd', yaml: 'yml', sql: 'sql',
  go: 'go', rust: 'rs', rs: 'rs', java: 'java', c: 'c', cpp: 'cpp', sh: 'sh', bash: 'sh',
}

function languageExtension(lang: string): Extension[] {
  const l = lang.toLowerCase()
  if (['js', 'jsx', 'javascript'].includes(l)) return [javascript({ jsx: true })]
  if (['ts', 'tsx', 'typescript'].includes(l)) return [javascript({ jsx: true, typescript: true })]
  if (['py', 'python'].includes(l)) return [python()]
  if (['html', 'htm', 'svg', 'xml'].includes(l)) return [html()]
  if (l === 'css') return [css()]
  if (l === 'json') return [json()]
  if (['md', 'markdown'].includes(l)) return [markdown()]
  return []
}

const SELECT_SCRIPT = `<script>(function(){var last=null;var s=document.createElement('style');s.textContent='.__sel_hover{outline:2px solid #6366f1 !important;outline-offset:-2px;cursor:crosshair !important;}';document.head&&document.head.appendChild(s);function cssPath(el){if(!(el instanceof Element))return '';var path=[];while(el&&el.nodeType===1&&path.length<5){var sel=el.nodeName.toLowerCase();if(el.id){sel+='#'+el.id;path.unshift(sel);break;}var n=el,i=1;while(n.previousElementSibling){n=n.previousElementSibling;if(n.nodeName===el.nodeName)i++;}sel+=':nth-of-type('+i+')';path.unshift(sel);el=el.parentElement;}return path.join(' > ');}document.addEventListener('mouseover',function(e){if(last&&last.classList)last.classList.remove('__sel_hover');last=e.target;if(last&&last.classList)last.classList.add('__sel_hover');},true);document.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var t=e.target;var html=(t.outerHTML||'').slice(0,600);parent.postMessage({type:'artifact-select',selector:cssPath(t),html:html},'*');},true);})();</script>`

function buildSrcDoc(kind: string, code: string, selectMode: boolean): string {
  const inject = selectMode ? SELECT_SCRIPT : ''
  if (kind === 'mermaid') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#fff;font-family:sans-serif}</style></head><body><pre class="mermaid">${code
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true});</script>${inject}</body></html>`
  }
  if (kind === 'svg') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}</style></head><body>${code}${inject}</body></html>`
  }
  // html — if it's a full document, inject before </body>, else wrap it.
  if (/<html[\s>]/i.test(code)) {
    return inject ? code.replace(/<\/body>/i, `${inject}</body>`) : code
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}</style></head><body>${code}${inject}</body></html>`
}

interface Selection {
  selector: string
  html: string
}

export function ArtifactPanel() {
  const openArtifactId = useChatStore((s) => s.openArtifactId)
  const artifact = useChatStore((s) => (openArtifactId ? s.artifacts[openArtifactId] : undefined))
  const setOpenArtifact = useChatStore((s) => s.setOpenArtifact)
  const setArtifactVersion = useChatStore((s) => s.setArtifactVersion)
  const addArtifactVersion = useChatStore((s) => s.addArtifactVersion)
  const deleteArtifact = useChatStore((s) => s.deleteArtifact)
  const theme = useChatStore((s) => s.settings.theme)

  const previewable = artifact
    ? ['html', 'svg', 'mermaid', 'markdown'].includes(artifact.kind)
    : false
  const canSelect = artifact ? ['html', 'svg'].includes(artifact.kind) : false

  const [tab, setTab] = useState<'code' | 'preview'>('code')
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [improving, setImproving] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCode = artifact ? artifact.versions[artifact.currentVersion].code : ''

  // Reset editor state when the artifact or its active version changes.
  useEffect(() => {
    setDraft(currentCode)
    setSelection(null)
    setSelectMode(false)
    setError(null)
  }, [openArtifactId, artifact?.currentVersion, currentCode])

  // Default to preview for visual artifacts.
  useEffect(() => {
    setTab(previewable ? 'preview' : 'code')
  }, [openArtifactId, previewable])

  // Receive element selections from the preview iframe.
  useEffect(() => {
    if (!selectMode) return
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (d && d.type === 'artifact-select') {
        setSelection({ selector: d.selector || '', html: d.html || '' })
        setSelectMode(false)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [selectMode])

  const cmExtensions = useMemo(
    () => (artifact ? languageExtension(artifact.language) : []),
    [artifact]
  )

  if (!artifact) return null

  const dirty = draft !== currentCode
  const versionCount = artifact.versions.length
  const cmTheme = theme === 'light' ? githubLight : githubDark

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const ext = EXT_MAP[artifact.language.toLowerCase()] ?? 'txt'
    const safe = artifact.title.replace(/[^a-z0-9_-]+/gi, '_')
    const blob = new Blob([draft], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSave = () => {
    if (!dirty) return
    addArtifactVersion(artifact.id, draft, 'Manual edit')
  }

  const handleImprove = async () => {
    if (!instruction.trim() || improving) return
    setImproving(true)
    setError(null)
    try {
      await improveArtifact({
        artifactId: artifact.id,
        instruction: instruction.trim(),
        selection: selection ? `${selection.selector}\n${selection.html}` : undefined,
        onProgress: (partial) => setDraft(partial),
      })
      setInstruction('')
      setSelection(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Improve failed')
    } finally {
      setImproving(false)
    }
  }

  const previewCode = dirty ? draft : currentCode

  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[560px] flex-col border-l border-border bg-card shadow-2xl md:w-[46vw]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Code2 className="h-4 w-4 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{artifact.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {languageLabel(artifact.language)}
          </p>
        </div>

        {/* Version switcher */}
        <div className="flex items-center gap-0.5 rounded-md border border-border">
          <button
            onClick={() => setArtifactVersion(artifact.id, artifact.currentVersion - 1)}
            disabled={artifact.currentVersion === 0}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Previous version"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="px-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            title="Version history"
          >
            v{artifact.currentVersion + 1}/{versionCount}
          </button>
          <button
            onClick={() => setArtifactVersion(artifact.id, artifact.currentVersion + 1)}
            disabled={artifact.currentVersion === versionCount - 1}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Next version"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Copy code"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          onClick={handleDownload}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            if (confirm('Delete this artifact?')) deleteArtifact(artifact.id)
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete artifact"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => setOpenArtifact(null)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Version history dropdown */}
      {showHistory && (
        <div className="max-h-48 overflow-y-auto border-b border-border bg-secondary/30 text-xs">
          {artifact.versions.map((v, i) => (
            <button
              key={i}
              onClick={() => {
                setArtifactVersion(artifact.id, i)
                setShowHistory(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent',
                i === artifact.currentVersion && 'bg-primary/10 text-primary'
              )}
            >
              <History className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono">v{i + 1}</span>
              <span className="truncate text-muted-foreground">{v.note}</span>
              <span className="ml-auto flex-shrink-0 text-[10px] text-muted-foreground">
                {new Date(v.createdAt).toLocaleTimeString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <button
          onClick={() => setTab('code')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            tab === 'code' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Code2 className="h-3.5 w-3.5" /> Code
        </button>
        {previewable && (
          <button
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              tab === 'preview' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        )}
        {dirty && (
          <button
            onClick={handleSave}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            title="Save as new version"
          >
            <Save className="h-3.5 w-3.5" /> Save version
          </button>
        )}
        {tab === 'preview' && canSelect && (
          <button
            onClick={() => setSelectMode((v) => !v)}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              selectMode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            title="Select an element in the preview to improve"
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            {selectMode ? 'Click an element…' : 'Select element'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        {tab === 'code' ? (
          <div className="h-full overflow-auto">
            <CodeMirror
              value={draft}
              theme={cmTheme}
              extensions={cmExtensions}
              editable={!improving}
              onChange={(val) => setDraft(val)}
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true }}
              height="100%"
              style={{ fontSize: 13, height: '100%' }}
            />
          </div>
        ) : artifact.kind === 'markdown' ? (
          <div className="chatgraph-scroll h-full overflow-auto bg-background p-4">
            <Markdown content={previewCode} />
          </div>
        ) : (
          <iframe
            key={`${artifact.id}-${selectMode}`}
            title="artifact-preview"
            sandbox="allow-scripts"
            className="h-full w-full border-0 bg-white"
            srcDoc={buildSrcDoc(artifact.kind, previewCode, selectMode)}
          />
        )}
      </div>

      {/* Improve bar */}
      <div className="border-t border-border p-2">
        {selection && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary">
            <MousePointerClick className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-mono">{selection.selector || 'selected element'}</span>
            <button
              onClick={() => setSelection(null)}
              className="ml-auto flex-shrink-0 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {error && <p className="mb-1.5 text-[11px] text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleImprove()
              }
            }}
            rows={1}
            placeholder={
              selection ? 'Improve the selected element…' : 'Ask AI to improve this artifact…'
            }
            className="chatgraph-scroll max-h-24 min-h-[38px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          />
          <button
            onClick={handleImprove}
            disabled={!instruction.trim() || improving}
            className="flex h-[38px] items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {improving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Improve
          </button>
        </div>
      </div>
    </div>
  )
}
