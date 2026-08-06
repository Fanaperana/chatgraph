import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import { Position } from '@xyflow/react'
import type { LayoutDirection } from '@/types/chat'

const NODE_WIDTH_PROMPT = 300
const NODE_WIDTH_RESPONSE = 340
const NODE_WIDTH_INPUT = 380
const NODE_HEIGHT_PROMPT = 100
const NODE_HEIGHT_RESPONSE = 140
const NODE_HEIGHT_INPUT = 80

function getNodeDimensions(node: Node) {
  switch (node.type) {
    case 'inputNode':
      return { width: NODE_WIDTH_INPUT, height: NODE_HEIGHT_INPUT }
    case 'responseNode': {
      // Response nodes grow with their markdown content (capped, then scrolls).
      const est = typeof node.data?.estHeight === 'number' ? node.data.estHeight : NODE_HEIGHT_RESPONSE
      return { width: NODE_WIDTH_RESPONSE, height: Math.min(Math.max(est, NODE_HEIGHT_RESPONSE), 420) }
    }
    default:
      return { width: NODE_WIDTH_PROMPT, height: NODE_HEIGHT_PROMPT }
  }
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  const isHorizontal = direction === 'LR'

  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
    align: 'UL',
  })

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node)
    g.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    const { width, height } = getNodeDimensions(node)

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}
