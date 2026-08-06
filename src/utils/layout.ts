import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import { Position } from '@xyflow/react'
import type { LayoutDirection } from '@/types/chat'

const NODE_WIDTH = 320
const NODE_HEIGHT_PROMPT = 100
const NODE_HEIGHT_RESPONSE = 140
const NODE_HEIGHT_INPUT = 80

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
  })

  nodes.forEach((node) => {
    const height =
      node.type === 'inputNode'
        ? NODE_HEIGHT_INPUT
        : node.type === 'responseNode'
          ? NODE_HEIGHT_RESPONSE
          : NODE_HEIGHT_PROMPT

    g.setNode(node.id, { width: NODE_WIDTH, height })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    const height =
      node.type === 'inputNode'
        ? NODE_HEIGHT_INPUT
        : node.type === 'responseNode'
          ? NODE_HEIGHT_RESPONSE
          : NODE_HEIGHT_PROMPT

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - height / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}
