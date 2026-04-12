import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
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
    join_type?: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many' | string;
    from_column?: string;
    to_column?: string;
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
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-obsidian-primary !border-obsidian-surface-mid" />
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-obsidian-secondary-purple !border-obsidian-surface-mid" />
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
                {data.columns?.slice(0, 8).map((col: any, index: number) => {
                    const isLinked = Array.isArray(data.linkedColumns) && data.linkedColumns.includes(col.name);
                    return (
                        <div
                            key={index}
                            className={`flex items-center justify-between px-4 py-1.5 transition-colors ${isLinked ? '' : 'hover:bg-obsidian-surface-high/30'}`}
                            style={isLinked ? { backgroundColor: 'rgba(139, 92, 246, 0.15)' } : undefined}
                        >
                            <div className="flex items-center gap-1.5">
                                {index === 0 && (
                                    <span className="material-symbols-outlined text-obsidian-primary" style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}>key</span>
                                )}
                                {isLinked && index !== 0 && (
                                    <span className="material-symbols-outlined" style={{ fontSize: '10px', color: '#8b5cf6', fontVariationSettings: "'FILL' 1" }}>link</span>
                                )}
                                <span className={`text-xs font-label ${isLinked ? 'font-bold' : 'text-obsidian-on-surface'}`} style={isLinked ? { color: '#8b5cf6' } : undefined}>{col.name}</span>
                            </div>
                            <span className="text-[10px] font-label text-obsidian-outline">
                                {col.type?.split('(')[0]?.substring(0, 10)}
                            </span>
                        </div>
                    );
                })}
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
    // Build a plain array of highlighted columns per table (columns involved in relationships).
    // Must be a plain array (not Set) so it survives ReactFlow's data cloning.
    const linkedColumns = useMemo(() => {
        const map: Record<string, string[]> = {};
        for (const rel of relationships) {
            if (rel.from_column) {
                const arr = (map[rel.from] ??= []);
                if (!arr.includes(rel.from_column)) arr.push(rel.from_column);
            }
            if (rel.to_column) {
                const arr = (map[rel.to] ??= []);
                if (!arr.includes(rel.to_column)) arr.push(rel.to_column);
            }
        }
        return map;
    }, [relationships]);

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
                    linkedColumns: linkedColumns[model.name],
                },
                selected: model.name === selectedNode,
            };
        });
    }, [models, selectedNode, linkedColumns]);

    const initialEdges: Edge[] = useMemo(() => {
        const cardinalityLabel = (joinType?: string) => {
            if (joinType === 'one_to_many') return '1:N';
            if (joinType === 'many_to_one') return 'N:1';
            if (joinType === 'many_to_many') return 'N:M';
            if (joinType === 'one_to_one') return '1:1';
            return '';
        };

        return relationships.map((rel) => {
            const cardinality = cardinalityLabel(rel.join_type);
            const colLabel = rel.from_column && rel.to_column
                ? `${rel.from_column} → ${rel.to_column}`
                : '';
            const label = colLabel
                ? (cardinality ? `${cardinality}  ${colLabel}` : colLabel)
                : cardinality;

            return {
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
                label,
                labelStyle: { fill: '#85948B', fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700 },
                labelBgStyle: { fill: '#201F1F', fillOpacity: 0.9 },
                labelBgPadding: [6, 4] as [number, number],
            };
        });
    }, [relationships]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync edges when relationships prop changes (initial render only captures once)
    useEffect(() => {
        setEdges(initialEdges);
    }, [initialEdges, setEdges]);

    // Sync nodes when models prop changes
    useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

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
