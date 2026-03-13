import { useState, useCallback, useEffect } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL, ApiError, getAuthToken } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, GitBranch, Sparkles, Save, Lock, Unlock } from 'lucide-react';
import SchemaGraph from '@/components/modeling/SchemaGraph';
import PropertySheet from '@/components/modeling/PropertySheet';

const API_BASE = `${API_BASE_URL}/api/v1`;

interface MDLContent {
    version: number;
    content: {
        models: Array<{
            name: string;
            columns: Array<{ name: string; type: string; description?: string }>;
        }>;
        relationships: Array<{
            name: string;
            from: string;
            to: string;
            condition: string;
        }>;
    };
    is_locked: boolean;
    locked_by: string | null;
}

interface RelationshipSuggestion {
    id: string;
    from_table: string;
    from_column: string;
    to_table: string;
    to_column: string;
    confidence: number;
    status: string;
}

export default function ModelingStudio() {
    const { toast } = useToast();
    const [mdl, setMdl] = useState<MDLContent | null>(null);
    const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasLock, setHasLock] = useState(false);
    const [conflictData, setConflictData] = useState<MDLContent | null>(null);

    // Get auth token
    const authHeaders = async (json = false): Promise<HeadersInit> => {
        const token = await getAuthToken();
        if (!token) {
            throw new ApiError('Not authenticated. Please sign in again.', 401);
        }
        return json
            ? {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
            : {
                Authorization: `Bearer ${token}`,
            };
    };

    // Fetch MDL
    const fetchMDL = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/semantic/mdl`, {
                headers: await authHeaders(),
            });
            if (response.ok) {
                const data = await response.json();
                setMdl(data);
            }
        } catch (error) {
            console.error('Failed to fetch MDL:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch suggestions
    const fetchSuggestions = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/semantic/relationships/suggestions?status_filter=pending`, {
                headers: await authHeaders(),
            });
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data);
            }
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
        }
    }, []);

    useEffect(() => {
        fetchMDL();
        fetchSuggestions();
    }, [fetchMDL, fetchSuggestions]);

    // Acquire lock
    const acquireLock = async () => {
        try {
            const response = await fetch(`${API_BASE}/semantic/mdl/lock`, {
                method: 'POST',
                headers: await authHeaders(),
            });
            if (response.ok) {
                const data = await response.json();
                setHasLock(data.acquired);
                if (data.acquired) {
                    toast({ title: 'Lock acquired', description: 'You can now edit the model.' });
                } else {
                    toast({
                        title: 'Lock unavailable',
                        description: `Locked by ${data.locked_by}`,
                        variant: 'destructive',
                    });
                }
            }
        } catch (error) {
            console.error('Failed to acquire lock:', error);
        }
    };

    // Release lock
    const releaseLock = async () => {
        try {
            await fetch(`${API_BASE}/semantic/mdl/lock`, {
                method: 'DELETE',
                headers: await authHeaders(),
            });
            setHasLock(false);
            toast({ title: 'Lock released' });
        } catch (error) {
            console.error('Failed to release lock:', error);
        }
    };

    // Save MDL
    const saveMDL = async (forceOverwrite = false) => {
        if (!mdl || !hasLock) return;

        // If overwriting, use the conflict version as base to trick the strict check
        const baseVersion = forceOverwrite && conflictData ? conflictData.version : mdl.version;

        setIsSaving(true);
        setConflictData(null);

        try {
            const response = await fetch(`${API_BASE}/semantic/mdl`, {
                method: 'PUT',
                headers: await authHeaders(true),
                body: JSON.stringify({
                    content: mdl.content,
                    base_version: baseVersion,
                    change_summary: forceOverwrite ? 'Force overwrite after conflict' : 'Updated via Modeling Studio',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setMdl(data);
                toast({ title: 'Model saved', description: `Version ${data.version}` });
            } else if (response.status === 409) {
                const errorData = await response.json();
                setConflictData(errorData.latest);
                toast({
                    title: 'Conflict detected',
                    description: 'Model was modified by another user.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Failed to save MDL:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Generate suggestions
    const generateSuggestions = async () => {
        setIsGenerating(true);
        try {
            const response = await fetch(`${API_BASE}/semantic/relationships/suggest`, {
                method: 'POST',
                headers: await authHeaders(),
            });

            if (response.ok) {
                const data = await response.json();
                toast({
                    title: 'Suggestions generated',
                    description: `Found ${data.suggestions?.length || 0} potential relationships`,
                });
                fetchSuggestions();
            }
        } catch (error) {
            console.error('Failed to generate suggestions:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Confirm/reject suggestion
    const handleSuggestionAction = async (id: string, action: 'confirm' | 'reject') => {
        try {
            const response = await fetch(`${API_BASE}/semantic/relationships/confirm`, {
                method: 'POST',
                headers: await authHeaders(true),
                body: JSON.stringify({ relationship_id: id, action }),
            });

            if (response.ok) {
                toast({ title: `Relationship ${action}ed` });
                fetchSuggestions();
                fetchMDL();
            }
        } catch (error) {
            console.error('Failed to handle suggestion:', error);
        }
    };

    const resolveConflict = (action: 'overwrite' | 'reload') => {
        if (!conflictData) return;

        if (action === 'reload') {
            setMdl(conflictData);
            setConflictData(null);
            toast({ title: 'Reloaded latest version', description: 'Your local changes were discarded.' });
        } else {
            // Overwrite: Try saving again with the latest version number
            saveMDL(true);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background relative">
            {/* Conflict Resolution Dialog */}
            {conflictData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-slate-900 border-red-500 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-red-500 flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Conflict Detected
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-300">
                                Another user (Version {conflictData.version}) has modified this model while you were editing (Version {mdl?.version}).
                            </p>
                            <div className="p-3 bg-slate-800 rounded border border-slate-700 text-sm font-mono text-slate-400">
                                Latest change: {conflictData.created_by ? `User ${conflictData.created_by}` : 'Unknown'}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => resolveConflict('reload')}
                                >
                                    Discard My Changes (Reload)
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1 bg-red-600 hover:bg-red-700"
                                    onClick={() => resolveConflict('overwrite')}
                                >
                                    Force Overwrite
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Header */}
            <header className="border-b border-border bg-card/80 backdrop-blur-xl px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <GitBranch className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">Modeling Studio</h1>
                            <p className="text-sm text-muted-foreground">
                                Version {mdl?.version || 0} •
                                {mdl?.content?.models?.length || 0} models •
                                {mdl?.content?.relationships?.length || 0} relationships
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {suggestions.length > 0 && (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                                {suggestions.length} pending suggestions
                            </Badge>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={generateSuggestions}
                            disabled={isGenerating}
                            className="border-slate-600 hover:bg-slate-800"
                        >
                            {isGenerating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Suggest Relationships
                        </Button>

                        {hasLock ? (
                            <>
                                <Button
                                    size="sm"
                                    onClick={() => saveMDL(false)}
                                    disabled={isSaving}
                                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={releaseLock}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <Unlock className="h-4 w-4 mr-2" />
                                    Release Lock
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={acquireLock}
                                className="border-slate-600 hover:bg-slate-800"
                            >
                                <Lock className="h-4 w-4 mr-2" />
                                {mdl?.is_locked ? `Locked by ${mdl.locked_by}` : 'Edit Model'}
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal">
                    {/* Left: Schema Graph */}
                    <ResizablePanel defaultSize={65} minSize={40}>
                        <div className="h-full p-4">
                            <Card className="h-full bg-card/50 border-border backdrop-blur-sm">
                                <CardHeader className="py-3 border-b border-border">
                                    <CardTitle className="text-sm font-medium text-foreground">
                                        Schema Graph
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[calc(100%-60px)] p-0">
                                    <SchemaGraph
                                        models={mdl?.content?.models || []}
                                        relationships={mdl?.content?.relationships || []}
                                        onNodeSelect={setSelectedNode}
                                        selectedNode={selectedNode}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

                    {/* Right: Property Sheet + Suggestions */}
                    <ResizablePanel defaultSize={35} minSize={25}>
                        <div className="h-full p-4 overflow-y-auto">
                            <Tabs defaultValue="properties" className="h-full">
                                <TabsList className="w-full bg-muted border border-border">
                                    <TabsTrigger value="properties" className="flex-1">Properties</TabsTrigger>
                                    <TabsTrigger value="suggestions" className="flex-1">
                                        Suggestions
                                        {suggestions.length > 0 && (
                                            <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-500 text-xs">
                                                {suggestions.length}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="properties" className="mt-4">
                                    <PropertySheet
                                        models={mdl?.content?.models || []}
                                        selectedNode={selectedNode}
                                        isEditable={hasLock}
                                        onUpdate={(updatedModels) => {
                                            if (mdl) {
                                                setMdl({
                                                    ...mdl,
                                                    content: { ...mdl.content, models: updatedModels },
                                                });
                                            }
                                        }}
                                    />
                                </TabsContent>

                                <TabsContent value="suggestions" className="mt-4 space-y-3">
                                    {suggestions.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                            <p>No pending suggestions</p>
                                            <p className="text-sm mt-1">Click "Suggest Relationships" to analyze schema</p>
                                        </div>
                                    ) : (
                                        suggestions.map((suggestion) => (
                                            <Card key={suggestion.id} className="bg-card border-border">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Badge
                                                            variant="secondary"
                                                            className={
                                                                suggestion.confidence >= 0.7
                                                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                                                    : suggestion.confidence >= 0.5
                                                                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                                        : 'bg-muted text-muted-foreground'
                                                            }
                                                        >
                                                            {Math.round(suggestion.confidence * 100)}% confidence
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-foreground mb-3">
                                                        <code className="bg-muted px-1 rounded">
                                                            {suggestion.from_table}.{suggestion.from_column}
                                                        </code>
                                                        <span className="mx-2 text-muted-foreground">→</span>
                                                        <code className="bg-muted px-1 rounded">
                                                            {suggestion.to_table}.{suggestion.to_column}
                                                        </code>
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSuggestionAction(suggestion.id, 'confirm')}
                                                            className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                                        >
                                                            Confirm
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleSuggestionAction(suggestion.id, 'reject')}
                                                            className="flex-1 text-muted-foreground hover:text-destructive"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
