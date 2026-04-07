import { useState, useEffect } from 'react';
import { Icon } from '@/components/Icon';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Column {
    name: string;
    type: string;
    description?: string;
}

interface Model {
    name: string;
    columns: Column[];
}

interface PropertySheetProps {
    models: Model[];
    selectedNode: string | null;
    isEditable: boolean;
    onUpdate: (updatedModels: Model[]) => void;
}

export default function PropertySheet({
    models,
    selectedNode,
    isEditable,
    onUpdate,
}: PropertySheetProps) {
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [editedDescriptions, setEditedDescriptions] = useState<Record<string, string>>({});

    useEffect(() => {
        if (selectedNode) {
            const model = models.find((m) => m.name === selectedNode);
            setSelectedModel(model || null);

            if (model) {
                const descs: Record<string, string> = {};
                model.columns.forEach((col) => {
                    descs[col.name] = col.description || '';
                });
                setEditedDescriptions(descs);
            }
        } else {
            setSelectedModel(null);
            setEditedDescriptions({});
        }
    }, [selectedNode, models]);

    const handleDescriptionChange = (columnName: string, description: string) => {
        if (!isEditable) return;

        setEditedDescriptions((prev) => ({ ...prev, [columnName]: description }));

        const updatedModels = models.map((model) => {
            if (model.name !== selectedNode) return model;

            return {
                ...model,
                columns: model.columns.map((col) => {
                    if (col.name !== columnName) return col;
                    return { ...col, description };
                }),
            };
        });

        onUpdate(updatedModels);
    };

    if (!selectedNode || !selectedModel) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-xl bg-obsidian-surface-mid flex items-center justify-center mb-4 border border-obsidian-outline-variant/15">
                    <Icon name="table_chart" size="lg" className="text-obsidian-outline" />
                </div>
                <h3 className="text-sm font-bold text-obsidian-on-surface mb-1">No Table Selected</h3>
                <p className="text-xs text-obsidian-on-surface-variant max-w-[200px]">
                    Click on any table node in the Schema Graph to view and edit its properties.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Model Header */}
            <div className="bg-obsidian-surface-mid rounded-lg border border-obsidian-outline-variant/10 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <Icon name="table_chart" size="sm" className="text-obsidian-primary" />
                    <div>
                        <h3 className="text-sm font-bold text-obsidian-on-surface">
                            {selectedModel.name.split('.').pop()}
                        </h3>
                        <p className="font-label text-[10px] text-obsidian-on-surface-variant tracking-wider">{selectedModel.name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-obsidian-surface-high text-[10px] font-label font-bold text-obsidian-on-surface-variant rounded">
                        {selectedModel.columns.length} columns
                    </span>
                    {!isEditable && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-[10px] font-label font-bold text-amber-400 rounded">
                            Read-only
                        </span>
                    )}
                </div>
            </div>

            {/* Columns List */}
            <div className="bg-obsidian-surface-mid rounded-lg border border-obsidian-outline-variant/10 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-obsidian-outline-variant/10">
                    <span className="font-label text-[10px] uppercase tracking-[0.15em] font-bold text-obsidian-on-surface-variant">Columns</span>
                </div>
                <ScrollArea className="h-[400px]">
                    <div className="space-y-px p-2">
                        {selectedModel.columns.map((column) => (
                            <div
                                key={column.name}
                                className="p-3 rounded-lg hover:bg-obsidian-surface-high/50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-obsidian-on-surface">{column.name}</span>
                                    <span className="px-1.5 py-0.5 bg-obsidian-surface-high rounded text-[10px] font-label text-obsidian-outline">
                                        {column.type?.split('(')[0]}
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-label text-[9px] uppercase tracking-[0.15em] text-obsidian-outline flex items-center gap-1">
                                        <Icon name="description" size="sm" className="text-obsidian-outline" />
                                        Description
                                    </label>
                                    {isEditable ? (
                                        <textarea
                                            value={editedDescriptions[column.name] || ''}
                                            onChange={(e) => handleDescriptionChange(column.name, e.target.value)}
                                            placeholder="Add a business description..."
                                            className="w-full min-h-[56px] bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 rounded-lg px-3 py-2 text-xs text-obsidian-on-surface placeholder:text-obsidian-outline/40 focus:outline-none focus:border-obsidian-primary transition-colors resize-none"
                                        />
                                    ) : (
                                        <p className="text-xs text-obsidian-on-surface-variant italic">
                                            {column.description || 'No description'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
