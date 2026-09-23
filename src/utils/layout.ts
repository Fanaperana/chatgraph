import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import { Position } from '@xyflow/react'
import type { LayoutDirection } from '@/types/chat'

const NODE_WIDTH_PROMPT = 300
const NODE_WIDTH_RESPONSE = 340
const NODE_WIDTH_INPUT = 380
const NODE_HEIGHT_PROMPT = 84
const NODE_HEIGHT_RESPONSE = 92
const NODE_HEIGHT_INPUT = 72

function getNodeDimensions(node: Node, heights?: Record<string, number>) {
  // Prefer the real measured height (from React Flow after render) so gaps
  // between ranks stay uniform regardless of content.
  const measured = heights?.[node.id]
  switch (node.type) {
    case 'inputNode':
      return { width: NODE_WIDTH_INPUT, height: measured ?? NODE_HEIGHT_INPUT }
    case 'responseNode': {
      // Response nodes grow with their markdown content. Scrollable nodes pass
      // a fixed estHeight; expanded nodes grow up to a generous ceiling.
      const est = typeof node.data?.estHeight === 'number' ? node.data.estHeight : NODE_HEIGHT_RESPONSE
      const height = measured ?? Math.max(est, NODE_HEIGHT_RESPONSE)
      return { width: NODE_WIDTH_RESPONSE, height: Math.min(height, 2400) }
    }
    default:
      return { width: NODE_WIDTH_PROMPT, height: measured ?? NODE_HEIGHT_PROMPT }
  }
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'TB',
  heights?: Record<string, number>
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  const isHorizontal = direction === 'LR'

  // Reasoning/thinking nodes hang off the RIGHT side of their anchor and must
  // not participate in dagre's ranking (otherwise they stack underneath).
  const thinkingIds = new Set(
    nodes.filter((n) => n.type === 'thinkingNode').map((n) => n.id)
  )
  const mainNodes = nodes.filter((n) => !thinkingIds.has(n.id))
  const mainEdges = edges.filter(
    (e) => !thinkingIds.has(e.source) && !thinkingIds.has(e.target)
  )

  g.setGraph({
    rankdir: direction,
    nodesep: 48,
    ranksep: 52,
    marginx: 20,
    marginy: 20,
    align: 'UL',
  })

  mainNodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node, heights)
    g.setNode(node.id, { width, height })
  })

  mainEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const posMap: Record<string, { x: number; y: number; width: number; height: number }> = {}
  const layoutedMain = mainNodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    const { width, height } = getNodeDimensions(node, heights)
    const x = nodeWithPosition.x - width / 2
    const y = nodeWithPosition.y - height / 2
    posMap[node.id] = { x, y, width, height }

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x, y },
    }
  })

  // Place each thinking node just to the right of its anchor, top-aligned.
  const GAP = 40
  const thinkingNodes = nodes.filter((n) => thinkingIds.has(n.id))
  const layoutedThinking = thinkingNodes.map((node) => {
    const anchorId = edges.find((e) => e.target === node.id)?.source
    const anchor = anchorId ? posMap[anchorId] : undefined
    const position = anchor
      ? { x: anchor.x + anchor.width + GAP, y: anchor.y }
      : { x: 0, y: 0 }

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position,
    }
  })

  return { nodes: [...layoutedMain, ...layoutedThinking], edges }
}
