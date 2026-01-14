import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface GraphNode {
  id: string
  type: 'claim' | 'recourse'
  label: string
  command?: string
}

interface GraphEdge {
  source: string
  target: string
  type: string
  color: string
}

interface CommandGroup {
  command: string
  utterances: { id: string; text: string; targetClaimId?: string }[]
}

interface GraphViewProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  commandGroups?: CommandGroup[]
}

const nodeColors: Record<string, string> = {
  claim: '#3b82f6',
  PROPOSE: '#3b82f6',
  CHALLENGE: '#ef4444',
  SUPPORT: '#22c55e',
  AMEND: '#f59e0b',
  QUESTION: '#a855f7',
  default: '#6b7280',
}

export default function GraphView({ nodes: graphNodes, edges: graphEdges, commandGroups }: GraphViewProps) {
  // Convert to ReactFlow format - group by command, then by utterance
  const initialNodes: Node[] = useMemo(() => {
    if (!commandGroups || commandGroups.length === 0) {
      // Fallback to original layout
      const claims = graphNodes.filter(n => n.type === 'claim')
      const recourses = graphNodes.filter(n => n.type === 'recourse')
      
      return [
        ...claims.map((node, i) => ({
          id: node.id,
          type: 'default',
          position: { x: 150, y: i * 150 + 50 },
          data: { 
            label: (
              <div style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>CLAIM</div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{node.label}</div>
              </div>
            )
          },
          style: {
            background: nodeColors.claim,
            color: 'white',
            border: '2px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '12px',
            padding: '10px',
            width: 200,
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
          },
        })),
        ...recourses.map((node, i) => ({
          id: node.id,
          type: 'default',
          position: { x: 450, y: i * 120 + 80 },
          data: { 
            label: (
              <div style={{ textAlign: 'center', padding: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600 }}>{node.command}</div>
              </div>
            )
          },
          style: {
            background: nodeColors[node.command as keyof typeof nodeColors] || nodeColors.default,
            color: 'white',
            border: `2px solid ${nodeColors[node.command as keyof typeof nodeColors] || nodeColors.default}`,
            borderRadius: '8px',
            padding: '8px',
            width: 120,
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
          },
        })),
      ]
    }

    // Layout grouped by command columns, utterances as rows
    const nodes: Node[] = []
    const commandOrder = ['PROPOSE', 'CHALLENGE', 'SUPPORT', 'AMEND', 'QUESTION']
    const sortedGroups = [...commandGroups].sort((a, b) => {
      const aIdx = commandOrder.indexOf(a.command)
      const bIdx = commandOrder.indexOf(b.command)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })

    sortedGroups.forEach((group, colIdx) => {
      const xPos = colIdx * 280 + 50
      const color = nodeColors[group.command] || nodeColors.default

      group.utterances.forEach((utterance, rowIdx) => {
        const yPos = rowIdx * 140 + 50
        const truncatedText = utterance.text.slice(0, 60) + (utterance.text.length > 60 ? '...' : '')

        nodes.push({
          id: utterance.id,
          type: 'default',
          position: { x: xPos, y: yPos },
          data: {
            label: (
              <div style={{ textAlign: 'left', padding: '8px' }}>
                <div style={{ 
                  fontSize: '9px', 
                  color: 'rgba(255,255,255,0.7)', 
                  marginBottom: '4px',
                  fontWeight: 600,
                  letterSpacing: '0.5px'
                }}>
                  {group.command}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  lineHeight: '1.4',
                  color: 'white'
                }}>
                  {truncatedText || '(no text)'}
                </div>
              </div>
            )
          },
          style: {
            background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
            color: 'white',
            border: `2px solid ${color}`,
            borderRadius: '10px',
            padding: '6px',
            width: 240,
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            boxShadow: `0 4px 12px ${color}33`,
          },
        })
      })
    })

    return nodes
  }, [graphNodes, commandGroups])

  const initialEdges: Edge[] = useMemo(() => {
    return graphEdges.map((edge, i) => ({
      id: `edge-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      style: { 
        stroke: edge.color,
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.color,
        width: 20,
        height: 20,
      },
      label: edge.type,
      labelStyle: {
        fontSize: '9px',
        fontFamily: 'JetBrains Mono, monospace',
        fill: '#888',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: '#0a0a0a',
        fillOpacity: 0.8,
      },
    }))
  }, [graphEdges])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node)
  }, [])

  return (
    <div style={{ width: '100%', height: '500px', background: '#0a0a0a', borderRadius: '12px', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
        style={{ background: '#0a0a0a' }}
      >
        <Background color="#1a1a1a" gap={20} size={1} />
        <Controls 
          style={{ 
            background: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '8px',
          }} 
        />
        <MiniMap 
          nodeColor={(node) => {
            const style = node.style as Record<string, unknown>
            return (style?.background as string) || '#6b7280'
          }}
          style={{ 
            background: '#0a0a0a', 
            border: '1px solid #1a1a1a',
            borderRadius: '8px',
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
      </ReactFlow>
    </div>
  )
}
