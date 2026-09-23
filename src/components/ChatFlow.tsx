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
import { ThinkingNode } from '@/components/nodes/ThinkingNode'
import { Toolbar } from '@/components/Toolbar'

const nodeTypes = {
  promptNode: PromptNode,
  responseNode: ResponseNode,
  inputNode: InputNode,
  thinkingNode: ThinkingNode,
}

// Rough estimate of a response node's rendered height so Dagre can reserve
// vertical space. Non-scrollable nodes grow with their content; scrollable
// nodes are capped to a fixed height. Kept tight to avoid large gaps.
function estimateResponseHeight(content: string, scrollable?: boolean): number {
  if (scrollable) return 340
  if (!content) return 96
  const lines = content.split('\n')
  let rows = 0
  for (const line of lines) rows += Math.max(1, Math.ceil(line.length / 46))
  return 52 + rows * 20
}

function ChatFlowInner() {
  const { trees, activeTreeId, settings } = useChatStore()
  const tree = activeTreeId ? trees[activeTreeId] : null
  const { fitView } = useReactFlow()

  // Track whether the user has manually dragged nodes
  const [isDragged, setIsDragged] = useState(false)
  const prevStructureRef = useRef<string | null>(null)
  const measureSigRef = useRef<string>('')
  // The node the viewport is currently following (streaming or just-finished).
  const focusRef = useRef<string | null>(null)
  const lastFollowRef = useRef(0)

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

    // The single assistant node currently generating a response (if any).
    const streamingNode = Object.values(tree.nodes).find(
      (n) => n.isStreaming && n.role === 'assistant'
    )
    // "Thinking" phase = streaming but no tokens yet. We hide the empty
    // response node and show a thinking indicator in its place.
    const thinkingPhase = !!streamingNode && streamingNode.content === ''

    Object.values(tree.nodes).forEach((chatNode) => {
      if (thinkingPhase && streamingNode && chatNode.id === streamingNode.id) return
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
          scrollable: chatNode.scrollable,
          estHeight: isUser
            ? undefined
            : estimateResponseHeight(chatNode.content, chatNode.scrollable),
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

    // Add extra input nodes at fork points, so the user can start an
    // alternative branch from a node (even one that already has an input).
    const forkPoints = tree.forkPoints ?? []
    forkPoints.forEach((parentId) => {
      if (!tree.nodes[parentId]) return // node was removed
      const inputId = `input-fork-${parentId}`
      nodes.push({
        id: inputId,
        type: 'inputNode',
        position: { x: 0, y: 0 },
        data: { parentNodeId: parentId },
      })
      edges.push({
        id: `${parentId}-${inputId}`,
        source: parentId,
        target: inputId,
        type: 'smoothstep',
        style: { stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 4' },
      })
    })

    // Reasoning / thinking nodes attach to the RIGHT of a node. While the
    // model is thinking (no tokens yet) it hangs off the prompt; once tokens
    // stream it hangs off the response. If the model exposed thinking steps we
    // keep the node afterwards so the steps can be reviewed (collapsible).
    Object.values(tree.nodes).forEach((a) => {
      if (a.role !== 'assistant') return
      const hasReasoning = !!a.reasoning && a.reasoning.trim() !== ''
      if (!a.isStreaming && !hasReasoning) return

      const isThinking = a.isStreaming && a.content === ''
      const phase = isThinking ? 'thinking' : a.isStreaming ? 'responding' : 'done'
      const anchorId = isThinking ? a.parentId : a.id
      if (!anchorId || !tree.nodes[anchorId]) return

      const reasoningId = `reasoning-${a.id}`
      nodes.push({
        id: reasoningId,
        type: 'thinkingNode',
        position: { x: 0, y: 0 },
        data: { phase, reasoning: a.reasoning, streaming: !!a.isStreaming },
      })
      edges.push({
        id: `${anchorId}-${reasoningId}`,
        source: anchorId,
        target: reasoningId,
        type: 'smoothstep',
        animated: !!a.isStreaming,
        style: {
          stroke: 'var(--color-primary)',
          strokeWidth: 1,
          strokeDasharray: a.isStreaming ? '4 4' : undefined,
        },
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
        scrollables: flowNodes
          .filter((n) => n.data?.scrollable)
          .map((n) => n.id)
          .sort(),
        direction: settings.layoutDirection,
      }),
    [flowNodes, settings.layoutDirection]
  )

  // Data fingerprint: content / streaming / model of each node. Changes on
  // every streamed token so the rendered nodes stay in sync live.
  const dataFingerprint = useMemo(
    () =>
      JSON.stringify(
        flowNodes.map((n) => [
          n.id,
          n.data?.content,
          n.data?.isStreaming,
          n.data?.model,
          n.data?.scrollable,
          n.data?.reasoning,
        ])
      ),
    [flowNodes]
  )

  // Id of the node the viewport should follow while a response generates.
  // While thinking (no tokens yet) the response node is hidden, so we follow
  // the thinking indicator; once tokens arrive we follow the response node.
  const streamingNodeId = useMemo(() => {
    if (!tree) return null
    const streaming = Object.values(tree.nodes).find((n) => n.isStreaming)
    if (!streaming) return null
    return streaming.content === '' ? `reasoning-${streaming.id}` : streaming.id
  }, [tree])

  // Smoothly center the viewport on a single node.
  const centerNode = useCallback(
    (id: string, duration = 500) => {
      setTimeout(() => {
        fitView({ nodes: [{ id }], duration, maxZoom: 1.15, minZoom: 0.4, padding: 0.25 })
      }, 60)
    },
    [fitView]
  )

  // Re-apply layout only when the structure changes (nodes added/removed or
  // direction change) — not on every token — so positions/drags are preserved.
  // While a response is in focus (streaming or just finished) we skip the
  // whole-graph fit so the auto-follow keeps the response centered.
  useEffect(() => {
    if (prevStructureRef.current !== structureFingerprint) {
      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
      setIsDragged(false)
      prevStructureRef.current = structureFingerprint
      if (!focusRef.current) {
        setTimeout(() => fitView({ duration: 200 }), 50)
      }
    }
  }, [structureFingerprint, layoutedNodes, layoutedEdges, setNodes, setEdges, fitView])

  // Refine the layout using the real measured node heights (reported by React
  // Flow after render) so the spacing between every rank is uniform, instead of
  // relying on the rough height estimate. Runs whenever measurements change.
  useEffect(() => {
    if (isDragged) return
    const heights: Record<string, number> = {}
    let measuredCount = 0
    for (const n of nodes) {
      const h = n.measured?.height
      if (typeof h === 'number' && h > 0) {
        heights[n.id] = h
        measuredCount++
      }
    }
    // Wait until every node has been measured to avoid a partial, jumpy pass.
    if (measuredCount === 0 || measuredCount < nodes.length) return

    const sig = `${structureFingerprint}|${Object.entries(heights)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, h]) => `${id}:${Math.round(h)}`)
      .join(',')}`
    if (sig === measureSigRef.current) return
    measureSigRef.current = sig

    const { nodes: relaid } = getLayoutedElements(flowNodes, flowEdges, settings.layoutDirection, heights)
    const posById = new Map(relaid.map((n) => [n.id, n.position]))
    setNodes((prev) =>
      prev.map((n) => {
        const pos = posById.get(n.id)
        return pos ? { ...n, position: pos } : n
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, structureFingerprint, isDragged])

  // Auto-center the response node as it generates, and re-center once when it
  // finishes (instead of zooming back out to the whole graph).
  useEffect(() => {
    if (streamingNodeId) {
      focusRef.current = streamingNodeId
      centerNode(streamingNodeId)
    } else if (focusRef.current) {
      const finished = focusRef.current
      centerNode(finished)
      const t = setTimeout(() => {
        focusRef.current = null
      }, 900)
      return () => clearTimeout(t)
    }
  }, [streamingNodeId, centerNode])

  // Follow the streaming node as its content grows (throttled).
  useEffect(() => {
    if (!streamingNodeId) return
    const now = Date.now()
    if (now - lastFollowRef.current > 700) {
      lastFollowRef.current = now
      centerNode(streamingNodeId, 350)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFingerprint])

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
    // Prefer the real measured heights so the snapped layout matches what the
    // refinement effect produces (uniform gaps), instead of the rough estimate.
    const heights: Record<string, number> = {}
    for (const n of nodes) {
      const h = n.measured?.height
      if (typeof h === 'number' && h > 0) heights[n.id] = h
    }
    const useMeasured = Object.keys(heights).length === nodes.length && nodes.length > 0
    const { nodes: snapped, edges: snappedEdges } = useMeasured
      ? getLayoutedElements(flowNodes, flowEdges, settings.layoutDirection, heights)
      : { nodes: layoutedNodes, edges: layoutedEdges }
    const posById = new Map(snapped.map((n) => [n.id, n.position]))
    setNodes((prev) =>
      prev.map((n) => {
        const pos = posById.get(n.id)
        return pos ? { ...n, position: pos } : n
      })
    )
    setEdges(snappedEdges)
    setIsDragged(false)
    setTimeout(() => fitView({ duration: 300 }), 20)
  }, [nodes, flowNodes, flowEdges, settings.layoutDirection, layoutedNodes, layoutedEdges, setNodes, setEdges, fitView])

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
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === 'promptNode') return 'var(--color-primary)'
            if (node.type === 'responseNode') return 'var(--color-muted-foreground)'
            if (node.type === 'thinkingNode') return 'var(--color-primary)'
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
