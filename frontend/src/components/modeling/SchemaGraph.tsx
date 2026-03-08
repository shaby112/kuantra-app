import { useCallback, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface Model {
    name: string;
    columns: Array<{ name: string; type: string; description?: string }>;
}

interface Relationship {
    name: string;
    from: string;
    to: string;
    condition: string;
}

interface SchemaGraphProps {
    models: Model[];
    relationships: Relationship[];
    onNodeSelect: (nodeName: string | null) => void;
    selectedNode: string | null;
}

// Custom node component for tables
function TableNode({ data, selected }: { data: any; selected: boolean }) {
    return (
        <div
            className={`
        min-w-[200px] rounded-lg border-2 shadow-xl backdrop-blur-sm
        ${selected
                    ? 'border-violet-500 bg-violet-900/50 shadow-violet-500/20'
                    : 'border-slate-600 bg-slate-800/90 hover:border-slate-500'
                }
        transition-all duration-200
      `}
        >
            {/* Table Header */}
            <div className={`
        px-3 py-2 rounded-t-lg font-semibold text-sm
        ${selected ? 'bg-violet-500/30 text-violet-200' : 'bg-slate-700/50 text-slate-200'}
      `}>
                <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">📊</span>
                    {data.label}
                </div>
            </div>

            {/* Columns */}
            <div className="px-2 py-2 max-h-[200px] overflow-y-auto">
                {data.columns?.slice(0, 8).map((col: any, index: number) => (
                    <div
                        key={index}
                        className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-slate-700/30"
                    >
                        <span className="text-slate-300 truncate max-w-[120px]">{col.name}</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                            {col.type?.split('(')[0]?.substring(0, 10)}
                        </span>
                    </div>
                ))}
                {data.columns?.length > 8 && (
                    <div className="text-xs text-slate-500 px-2 py-1 italic">
                        +{data.columns.length - 8} more columns
                    </div>
                )}
            </div>
        </div>
    );
}

const nodeTypes = {
    tableNode: TableNode,
};

export default function SchemaGraph({
    models,
    relationships,
    onNodeSelect,
    selectedNode,
}: SchemaGraphProps) {
    // Convert models to nodes
    const initialNodes: Node[] = useMemo(() => {
        return models.map((model, index) => {
            // Auto-layout in a grid
            const col = index % 4;
            const row = Math.floor(index / 4);

            return {
                id: model.name,
                type: 'tableNode',
                position: { x: col * 280 + 50, y: row * 350 + 50 },
                data: {
                    label: model.name.split('.').pop(), // Remove schema prefix for display
                    columns: model.columns,
                },
                selected: model.name === selectedNode,
            };
        });
    }, [models, selectedNode]);

    // Convert relationships to edges
    const initialEdges: Edge[] = useMemo(() => {
        return relationships.map((rel) => ({
            id: rel.name,
            source: rel.from,
            target: rel.to,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#8b5cf6', strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#8b5cf6',
            },
            label: rel.name.length < 20 ? rel.name : '',
            labelStyle: { fill: '#94a3b8', fontSize: 10 },
            labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
        }));
    }, [relationships]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Handle node click
    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            onNodeSelect(node.id);
        },
        [onNodeSelect]
    );

    // Handle pane click (deselect)
    const onPaneClick = useCallback(() => {
        onNodeSelect(null);
    }, [onNodeSelect]);

    return (
        <div className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
                className="bg-slate-900"
            >
                <Background color="#334155" gap={20} size={1} />
                <Controls className="!bg-slate-800 !border-slate-700 !text-slate-300 [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button:hover]:!bg-slate-700" />
                <MiniMap
                    className="!bg-slate-800/80 !border-slate-700"
                    nodeColor={(node) => (node.selected ? '#8b5cf6' : '#475569')}
                    maskColor="rgba(15, 23, 42, 0.8)"
                />
            </ReactFlow>
        </div>
    );
}
