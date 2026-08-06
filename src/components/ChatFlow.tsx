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
  const prevStructureRef = useRef<string | null>(null)

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

  // Structural fingerprint: which nodes/edges exist (ids) + direction.
  // Includes synthetic input nodes, so it changes when a response finishes
  // streaming (a new input node appears at the leaf).
  const structureFingerprint = useMemo(
    () =>
      JSON.stringify({
        nodeIds: flowNodes.map((n) => n.id).sort(),
        direction: settings.layoutDirection,
      }),
    [flowNodes, settings.layoutDirection]
  )

  // Data fingerprint: content / streaming / model of each node. Changes on
  // every streamed token so the rendered nodes stay in sync live.
  const dataFingerprint = useMemo(
    () =>
      JSON.stringify(
        flowNodes.map((n) => [n.id, n.data?.content, n.data?.isStreaming, n.data?.model])
      ),
    [flowNodes]
  )

  // Re-apply layout only when the structure changes (nodes added/removed or
  // direction change) — not on every token — so positions/drags are preserved.
  useEffect(() => {
    if (prevStructureRef.current !== structureFingerprint) {
      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
      setIsDragged(false)
      prevStructureRef.current = structureFingerprint
      setTimeout(() => fitView({ duration: 200 }), 50)
    }
  }, [structureFingerprint, layoutedNodes, layoutedEdges, setNodes, setEdges, fitView])

  // Sync live data (streamed content, streaming flag, model) into existing
  // nodes without touching their positions, and keep edge animation in sync.
  useEffect(() => {
    const dataById = new Map(flowNodes.map((n) => [n.id, n.data]))
    setNodes((prev) =>
      prev.map((n) => {
        const data = dataById.get(n.id)
        return data ? { ...n, data } : n
      })
    )
    const edgeById = new Map(flowEdges.map((e) => [e.id, e]))
    setEdges((prev) =>
      prev.map((e) => {
        const next = edgeById.get(e.id)
        return next ? { ...e, animated: next.animated } : e
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFingerprint])

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
          className="!bg-card !border-border !rounded-[3px]"
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
