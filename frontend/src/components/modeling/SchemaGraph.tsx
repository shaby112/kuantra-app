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

function TableNode({ data, selected }: { data: any; selected: boolean }) {
    return (
        <div
            className={`
                min-w-[220px] rounded-lg overflow-hidden transition-all duration-200
                ${selected
                    ? 'border-l-[3px] border-obsidian-primary shadow-lg shadow-obsidian-primary/10'
                    : 'border-l-[3px] border-obsidian-outline-variant/40 hover:border-obsidian-secondary-purple/60'
                }
                bg-obsidian-surface-mid border border-obsidian-outline-variant/15
            `}
        >
            {/* Table Header */}
            <div className={`
                px-4 py-2.5 flex items-center justify-between
                ${selected ? 'bg-obsidian-surface-high' : 'bg-obsidian-surface-high/50'}
                border-b border-obsidian-outline-variant/10
            `}>
                <span className={`font-label font-bold text-xs tracking-wider ${selected ? 'text-obsidian-primary' : 'text-obsidian-on-surface'}`}>
                    {data.label}
                </span>
                <span className="material-symbols-outlined text-obsidian-outline" style={{ fontSize: '14px' }}>more_vert</span>
            </div>

            {/* Columns */}
            <div className="max-h-[200px] overflow-y-auto">
                {data.columns?.slice(0, 8).map((col: any, index: number) => (
                    <div
                        key={index}
                        className="flex items-center justify-between px-4 py-1.5 hover:bg-obsidian-surface-high/30 transition-colors"
                    >
                        <div className="flex items-center gap-1.5">
                            {index === 0 && (
                                <span className="material-symbols-outlined text-obsidian-primary" style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}>key</span>
                            )}
                            <span className="text-xs font-label text-obsidian-on-surface">{col.name}</span>
                        </div>
                        <span className="text-[10px] font-label text-obsidian-outline">
                            {col.type?.split('(')[0]?.substring(0, 10)}
                        </span>
                    </div>
                ))}
                {data.columns?.length > 8 && (
                    <div className="text-[10px] text-obsidian-outline px-4 py-1.5 font-label">
                        +{data.columns.length - 8} more
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
    const initialNodes: Node[] = useMemo(() => {
        return models.map((model, index) => {
            const col = index % 4;
            const row = Math.floor(index / 4);

            return {
                id: model.name,
                type: 'tableNode',
                position: { x: col * 280 + 50, y: row * 350 + 50 },
                data: {
                    label: model.name.split('.').pop(),
                    columns: model.columns,
                },
                selected: model.name === selectedNode,
            };
        });
    }, [models, selectedNode]);

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
            labelStyle: { fill: '#85948B', fontSize: 10, fontFamily: 'Space Grotesk' },
            labelBgStyle: { fill: '#201F1F', fillOpacity: 0.9 },
        }));
    }, [relationships]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            onNodeSelect(node.id);
        },
        [onNodeSelect]
    );

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
                className="bg-obsidian-surface"
            >
                <Background color="#3C4A42" gap={24} size={1} />
                <Controls className="!bg-obsidian-surface-mid !border-obsidian-outline-variant/20 !rounded-lg [&>button]:!bg-obsidian-surface-mid [&>button]:!border-obsidian-outline-variant/15 [&>button]:!text-obsidian-on-surface-variant [&>button:hover]:!bg-obsidian-surface-high" />
                <MiniMap
                    className="!bg-obsidian-surface-low/80 !border-obsidian-outline-variant/15 !rounded-lg"
                    nodeColor={(node) => (node.selected ? '#5AF0B3' : '#3C4A42')}
                    maskColor="rgba(19, 19, 19, 0.8)"
                />
            </ReactFlow>
        </div>
    );
}
