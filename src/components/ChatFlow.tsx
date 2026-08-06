import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useChatStore } from '@/store'
import { getLayoutedElements } from '@/utils/layout'
import { PromptNode } from '@/components/nodes/PromptNode'
import { ResponseNode } from '@/components/nodes/ResponseNode'
import { InputNode } from '@/components/nodes/InputNode'
import { LayoutToggle } from '@/components/LayoutToggle'
import { Toolbar } from '@/components/Toolbar'

const nodeTypes = {
  promptNode: PromptNode,
  responseNode: ResponseNode,
  inputNode: InputNode,
}

export function ChatFlow() {
  const { trees, activeTreeId, settings } = useChatStore()
  const tree = activeTreeId ? trees[activeTreeId] : null

  // Convert tree to flow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!tree || !tree.rootNodeId) {
      // Show only an input node when tree is empty
      const inputNode: Node = {
        id: 'input-root',
        type: 'inputNode',
        position: { x: 0, y: 0 },
        data: { parentNodeId: null },
      }
      return { flowNodes: [inputNode], flowEdges: [] }
    }

    const nodes: Node[] = []
    const edges: Edge[] = []

    // Walk the tree and create nodes/edges
    Object.values(tree.nodes).forEach((chatNode) => {
      const isUser = chatNode.role === 'user'
      nodes.push({
        id: chatNode.id,
        type: isUser ? 'promptNode' : 'responseNode',
        position: { x: 0, y: 0 },
        data: {
          content: chatNode.content,
          nodeId: chatNode.id,
          model: chatNode.model,
          isStreaming: chatNode.isStreaming,
        },
      })

      if (chatNode.parentId) {
        edges.push({
          id: `${chatNode.parentId}-${chatNode.id}`,
          source: chatNode.parentId,
          target: chatNode.id,
          type: 'smoothstep',
          animated: chatNode.isStreaming,
          style: { stroke: 'var(--color-border)', strokeWidth: 2 },
        })
      }
    })

    // Add input nodes at every leaf (nodes with no children)
    const leafNodes = Object.values(tree.nodes).filter(
      (n) => n.childrenIds.length === 0 && !n.isStreaming
    )

    leafNodes.forEach((leaf) => {
      const inputId = `input-${leaf.id}`
      nodes.push({
        id: inputId,
        type: 'inputNode',
        position: { x: 0, y: 0 },
        data: { parentNodeId: leaf.id },
      })
      edges.push({
        id: `${leaf.id}-${inputId}`,
        source: leaf.id,
        target: inputId,
        type: 'smoothstep',
        style: { stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' },
      })
    })

    return { flowNodes: nodes, flowEdges: edges }
  }, [tree])

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(flowNodes, flowEdges, settings.layoutDirection),
    [flowNodes, flowEdges, settings.layoutDirection]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  // Update when layout changes
  useMemo(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50)
  }, [])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
        <Controls className="!bg-card !border-border !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={(node) => {
            if (node.type === 'promptNode') return 'var(--color-primary)'
            if (node.type === 'responseNode') return 'var(--color-muted-foreground)'
            return 'var(--color-border)'
          }}
        />
      </ReactFlow>

      {/* Floating controls */}
      <Toolbar />
      <LayoutToggle />
    </div>
  )
}
