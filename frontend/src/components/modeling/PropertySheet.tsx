import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, Columns, Type, FileText } from 'lucide-react';

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

            // Initialize descriptions
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

        // Update models
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
            <Card className="bg-muted/30 border-border h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <Table className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Table Selected</h3>
                <p className="text-muted-foreground text-sm max-w-[200px]">
                    Click on any table node in the Schema Graph to view and edit its properties.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Model Header */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Table className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-foreground">
                                {selectedModel.name.split('.').pop()}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">{selectedModel.name}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            <Columns className="h-3 w-3 mr-1" />
                            {selectedModel.columns.length} columns
                        </Badge>
                        {!isEditable && (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                Read-only
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Columns List */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">Columns</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-1 p-4">
                            {selectedModel.columns.map((column) => (
                                <div
                                    key={column.name}
                                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-foreground">{column.name}</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                                            <Type className="h-3 w-3 mr-1" />
                                            {column.type?.split('(')[0]}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            Description
                                        </Label>
                                        {isEditable ? (
                                            <Textarea
                                                value={editedDescriptions[column.name] || ''}
                                                onChange={(e) => handleDescriptionChange(column.name, e.target.value)}
                                                placeholder="Add a business description..."
                                                className="min-h-[60px] bg-background border-input text-foreground placeholder:text-muted-foreground text-sm"
                                            />
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">
                                                {column.description || 'No description'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
