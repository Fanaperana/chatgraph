import { memo, isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store'
import { normalizeForMatch } from '@/utils/artifacts'
import { ArtifactCard } from '@/components/artifacts/ArtifactCard'
import type { Artifact } from '@/types/chat'

interface MarkdownProps {
  content: string
  className?: string
  /** When set, fenced code blocks matching this node's artifacts render as cards. */
  nodeId?: string
}

/** Recursively pull the plain text out of a rendered React node tree. */
function nodeText(node: ReactNode): string {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

function MarkdownComponent({ content, className, nodeId }: MarkdownProps) {
  const artifacts = useChatStore((s) => s.artifacts)

  const nodeArtifacts: Artifact[] = nodeId
    ? Object.values(artifacts).filter((a) => a.nodeId === nodeId)
    : []

  const resolveArtifact = (code: string): Artifact | undefined => {
    if (nodeArtifacts.length === 0) return undefined
    const target = normalizeForMatch(code)
    return nodeArtifacts.find((a) => normalizeForMatch(a.originalCode) === target)
  }

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          pre: ({ children }) => {
            const raw = nodeText(children)
            const artifact = resolveArtifact(raw)
            if (artifact) return <ArtifactCard artifactId={artifact.id} />
            return <pre>{children}</pre>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownComponent)
