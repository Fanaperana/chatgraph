import type { ArtifactKind } from '@/types/chat'

export interface ParsedCodeBlock {
  language: string
  code: string
  /** Filename hint parsed from the fence info string or a leading comment. */
  filename?: string
}

/** Languages that are usually inline snippets, not standalone artifacts. */
const INLINE_LANGUAGES = new Set([
  'bash', 'sh', 'shell', 'zsh', 'console', 'shell-session', 'shellsession',
  'text', 'plaintext', 'txt', 'log', 'diff', 'env', 'dotenv', 'ini', 'output',
])

/** Pull a filename out of a fence info string (after the language token). */
function filenameFromInfo(info: string): string | undefined {
  const rest = info.trim()
  // title="file" | title=file | {title=file}
  const titleMatch = rest.match(/title=["']?([^"'\s}]+)/i)
  if (titleMatch) return titleMatch[1]
  // lang:path/to/file.ext  (first token was language, remainder starts with :)
  const colonMatch = rest.match(/^[\w+-]+\s*:\s*([^\s]+)/)
  if (colonMatch && /\.[A-Za-z0-9]+$/.test(colonMatch[1])) return colonMatch[1]
  // A bare filename-looking token anywhere in the info string.
  const bare = rest.split(/\s+/).find((t) => /^[\w./-]+\.[A-Za-z0-9]+$/.test(t))
  return bare
}

/** Pull a filename out of the first line if it's a path comment. */
function filenameFromComment(code: string): string | undefined {
  const first = code.split('\n')[0].trim()
  const m = first.match(
    /^(?:\/\/|#|--|;|<!--|\/\*)\s*([\w./-]+\.[A-Za-z0-9]+)\s*(?:-->|\*\/)?$/
  )
  return m?.[1]
}

/**
 * Extract fenced code blocks (```lang ... ```) from markdown content.
 * Only closed blocks are returned so partial blocks aren't captured mid-stream.
 */
export function parseCodeBlocks(content: string): ParsedCodeBlock[] {
  const blocks: ParsedCodeBlock[] = []
  const fence = /```([^\n]*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = fence.exec(content)) !== null) {
    const info = (match[1] || '').trim()
    const language = (info.split(/[\s:]+/)[0] || '').toLowerCase()
    const code = match[2].replace(/\n$/, '')
    if (code.trim().length === 0) continue
    const filename = filenameFromInfo(info) ?? filenameFromComment(code)
    blocks.push({ language, code, filename })
  }
  return blocks
}

/**
 * Decide whether a code block is substantial enough to become an artifact.
 * Trivial shell/text snippets and one-liners stay inline as normal code.
 */
export function isArtifactWorthy(block: ParsedCodeBlock): boolean {
  const kind = detectKind(block.language, block.code)
  const previewable = kind !== 'code'
  if (previewable) return true
  if (INLINE_LANGUAGES.has(block.language)) return false
  const lines = block.code.split('\n').filter((l) => l.trim().length > 0)
  // Keep anything with a filename hint, otherwise require at least 2 real lines.
  if (block.filename) return true
  return lines.length >= 2
}

/** Map a fenced-block language to an artifact kind for preview handling. */
export function detectKind(language: string, code: string): ArtifactKind {
  const lang = language.toLowerCase()
  if (lang === 'html' || lang === 'htm') return 'html'
  if (lang === 'svg') return 'svg'
  if (lang === 'mermaid') return 'mermaid'
  if (lang === 'markdown' || lang === 'md') return 'markdown'
  if (lang === 'xml' && code.trim().startsWith('<svg')) return 'svg'
  return 'code'
}

/** Human-friendly language label for display. */
export function languageLabel(language: string): string {
  const map: Record<string, string> = {
    js: 'JavaScript',
    jsx: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    typescript: 'TypeScript',
    py: 'Python',
    python: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    rust: 'Rust',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
    php: 'PHP',
    sh: 'Shell',
    bash: 'Shell',
    zsh: 'Shell',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    sql: 'SQL',
    html: 'HTML',
    css: 'CSS',
    svg: 'SVG',
    mermaid: 'Mermaid',
    markdown: 'Markdown',
    md: 'Markdown',
  }
  if (!language) return 'Text'
  return map[language.toLowerCase()] ?? language.toUpperCase()
}

/** Derive a short title for the artifact from its filename / code / language. */
export function makeArtifactTitle(block: ParsedCodeBlock, index: number): string {
  const { code, language } = block
  if (block.filename) return block.filename
  // Try to find a meaningful name (function/class/component/def).
  const patterns = [
    /(?:export\s+)?(?:default\s+)?function\s+([A-Za-z0-9_]+)/,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:\(|async|function)/,
    /class\s+([A-Za-z0-9_]+)/,
    /def\s+([A-Za-z0-9_]+)/,
    /<title>([^<]+)<\/title>/i,
  ]
  for (const re of patterns) {
    const m = code.match(re)
    if (m?.[1]) return m[1]
  }
  const label = languageLabel(language)
  return index === 0 ? `${label} snippet` : `${label} snippet ${index + 1}`
}

/** Best-effort match of a rendered code block back to a stored artifact. */
export function normalizeForMatch(code: string): string {
  return code.trim()
}
