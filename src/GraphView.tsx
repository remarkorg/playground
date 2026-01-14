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

interface GraphViewProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const nodeColors = {
  claim: '#3b82f6',
  CHALLENGE: '#ef4444',
  SUPPORT: '#22c55e',
  AMEND: '#f59e0b',
  QUESTION: '#a855f7',
  default: '#6b7280',
}

export default function GraphView({ nodes: graphNodes, edges: graphEdges }: GraphViewProps) {
  // Convert to ReactFlow format
  const initialNodes: Node[] = useMemo(() => {
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
  }, [graphNodes])

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
            const style = node.style as any
            return style?.background || '#6b7280'
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
