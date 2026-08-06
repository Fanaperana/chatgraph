import { Code2, FileCode, Braces, PanelRight } from 'lucide-react'
import { useChatStore } from '@/store'
import { languageLabel } from '@/utils/artifacts'
import type { Artifact } from '@/types/chat'
import { cn } from '@/lib/utils'

function kindIcon(artifact: Artifact) {
  switch (artifact.kind) {
    case 'html':
    case 'svg':
      return <FileCode className="w-4 h-4" />
    case 'mermaid':
      return <Braces className="w-4 h-4" />
    default:
      return <Code2 className="w-4 h-4" />
  }
}

export function ArtifactCard({ artifactId }: { artifactId: string }) {
  const artifact = useChatStore((s) => s.artifacts[artifactId])
  const openArtifactId = useChatStore((s) => s.openArtifactId)
  const setOpenArtifact = useChatStore((s) => s.setOpenArtifact)
  if (!artifact) return null

  const code = artifact.versions[artifact.currentVersion].code
  const lineCount = code.split('\n').length
  const isOpen = openArtifactId === artifactId
  const versionCount = artifact.versions.length

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setOpenArtifact(artifactId)
      }}
      className={cn(
        'not-prose group/artifact my-2 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all',
        'bg-secondary/40 hover:bg-secondary border-border hover:border-primary/40',
        isOpen && 'border-primary/60 bg-secondary ring-1 ring-primary/30'
      )}
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {kindIcon(artifact)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{artifact.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {languageLabel(artifact.language)} · {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          {versionCount > 1 && ` · v${artifact.currentVersion + 1}/${versionCount}`}
        </span>
      </span>
      <PanelRight className="w-4 h-4 flex-shrink-0 text-muted-foreground transition-colors group-hover/artifact:text-primary" />
    </button>
  )
}
