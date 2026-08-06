import type { ArtifactKind } from '@/types/chat'

export interface ParsedCodeBlock {
  language: string
  code: string
}

/**
 * Extract fenced code blocks (```lang ... ```) from markdown content.
 * Only closed blocks are returned so partial blocks aren't captured mid-stream.
 */
export function parseCodeBlocks(content: string): ParsedCodeBlock[] {
  const blocks: ParsedCodeBlock[] = []
  const fence = /```([\w+-]*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = fence.exec(content)) !== null) {
    const language = (match[1] || '').trim().toLowerCase()
    const code = match[2].replace(/\n$/, '')
    if (code.trim().length === 0) continue
    blocks.push({ language, code })
  }
  return blocks
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

/** Derive a short title for the artifact from its code / language. */
export function makeArtifactTitle(block: ParsedCodeBlock, index: number): string {
  const { code, language } = block
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
