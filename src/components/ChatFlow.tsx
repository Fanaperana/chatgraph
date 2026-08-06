import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useChatStore } from '@/store'
import { getLayoutedElements } from '@/utils/layout'
import { PromptNode } from '@/components/nodes/PromptNode'
import { ResponseNode } from '@/components/nodes/ResponseNode'
import { InputNode } from '@/components/nodes/InputNode'
import { Toolbar } from '@/components/Toolbar'

const nodeTypes = {
  promptNode: PromptNode,
  responseNode: ResponseNode,
  inputNode: InputNode,
}

function ChatFlowInner() {
  const { trees, activeTreeId, settings } = useChatStore()
  const tree = activeTreeId ? trees[activeTreeId] : null
  const { fitView } = useReactFlow()

  // Track whether the user has manually dragged nodes
  const [isDragged, setIsDragged] = useState(false)
  const prevTreeRef = useRef<string | null>(null)

  // Convert tree to flow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!tree || !tree.rootNodeId) {
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

    // Add input nodes at every leaf
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

  // Compute the symmetrical layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(flowNodes, flowEdges, settings.layoutDirection),
    [flowNodes, flowEdges, settings.layoutDirection]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  // Serialize tree structure to detect data changes (not position changes)
  const treeFingerprint = useMemo(() => {
    if (!tree) return ''
    return JSON.stringify({
      nodeCount: Object.keys(tree.nodes).length,
      nodeIds: Object.keys(tree.nodes).sort(),
      direction: settings.layoutDirection,
    })
  }, [tree, settings.layoutDirection])

  // Auto-apply layout when tree data changes (new nodes, direction change)
  // but NOT when user has dragged nodes (unless data actually changed)
  useEffect(() => {
    if (prevTreeRef.current !== treeFingerprint) {
      // Data changed → snap to layout automatically
      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
      setIsDragged(false)
      prevTreeRef.current = treeFingerprint
      setTimeout(() => fitView({ duration: 200 }), 50)
    }
  }, [treeFingerprint, layoutedNodes, layoutedEdges, setNodes, setEdges, fitView])

  // Intercept node changes: detect user drags
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasDrag = changes.some(
        (c) => c.type === 'position' && c.dragging === true
      )
      if (hasDrag) {
        setIsDragged(true)
      }
      onNodesChange(changes)
    },
    [onNodesChange]
  )

  // "Snap to layout" button handler
  const snapToLayout = useCallback(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
    setIsDragged(false)
    setTimeout(() => fitView({ duration: 300 }), 20)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, fitView])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
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
      <Toolbar onSnapToLayout={snapToLayout} isDragged={isDragged} />
    </div>
  )
}

export function ChatFlow() {
  return (
    <ReactFlowProvider>
      <ChatFlowInner />
    </ReactFlowProvider>
  )
}
