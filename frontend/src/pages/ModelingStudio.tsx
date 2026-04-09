import { useState, useCallback, useEffect } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL, ApiError, getAuthToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Icon } from '@/components/Icon';
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
            join_type?: string;
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
    const [activePanel, setActivePanel] = useState<'properties' | 'suggestions'>('properties');

    const authHeaders = async (json = false): Promise<HeadersInit> => {
        const token = await getAuthToken();
        if (!token) {
            throw new ApiError('Not authenticated. Please sign in again.', 401);
        }
        return json
            ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            : { Authorization: `Bearer ${token}` };
    };

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

    const fetchSuggestions = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/semantic/relationships/suggestions?status_filter=pending`, {
                headers: await authHeaders(),
            });
            if (response.ok) {
                const data = await response.json();
                setSuggestions(Array.isArray(data) ? data : []);
            } else {
                console.error('Failed to fetch suggestions:', response.status, await response.text());
                setSuggestions([]);
            }
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
            setSuggestions([]);
        }
    }, []);

    useEffect(() => {
        fetchMDL();
        fetchSuggestions();
    }, [fetchMDL, fetchSuggestions]);

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
                    toast({ title: 'Lock unavailable', description: `Locked by ${data.locked_by}`, variant: 'destructive' });
                }
            }
        } catch (error) {
            console.error('Failed to acquire lock:', error);
        }
    };

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

    const saveMDL = async (forceOverwrite = false) => {
        if (!mdl || !hasLock) return;

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
                toast({ title: 'Conflict detected', description: 'Model was modified by another user.', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Failed to save MDL:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const generateSuggestions = async () => {
        setIsGenerating(true);
        try {
            const response = await fetch(`${API_BASE}/semantic/relationships/suggest`, {
                method: 'POST',
                headers: await authHeaders(),
            });

            if (response.ok) {
                const data = await response.json();
                const generated = Array.isArray(data?.suggestions) ? data.suggestions : [];
                const pending = generated.filter((s: RelationshipSuggestion) => s.status === 'pending');
                setSuggestions(pending);
                setActivePanel('suggestions');
                toast({ title: 'Suggestions generated', description: `Found ${pending.length} potential relationships` });
            } else {
                const detail = await response.text();
                toast({ title: 'Suggestion generation failed', description: detail || 'Unknown error', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Failed to generate suggestions:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSuggestionAction = async (id: string, action: 'confirm' | 'reject') => {
        try {
            const response = await fetch(`${API_BASE}/semantic/relationships/confirm`, {
                method: 'POST',
                headers: await authHeaders(true),
                body: JSON.stringify({ relationship_id: id, action }),
            });

            if (response.ok) {
                toast({ title: `Relationship ${action}ed` });
                // Remove the actioned suggestion from local state immediately
                setSuggestions(prev => prev.filter(s => s.id !== id));
                // Refresh MDL to pick up the new relationship edge
                if (action === 'confirm') {
                    await fetchMDL();
                }
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
            saveMDL(true);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-obsidian-surface">
                <Icon name="progress_activity" size="lg" className="text-obsidian-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-obsidian-surface relative">
            {/* Conflict Resolution Overlay */}
            {conflictData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-obsidian-surface-mid border border-red-500/30 rounded-lg shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-obsidian-outline-variant/10 flex items-center gap-2">
                            <Icon name="error" size="md" className="text-red-400" />
                            <h3 className="text-sm font-bold text-red-400">Conflict Detected</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-obsidian-on-surface-variant">
                                Another user (Version {conflictData.version}) has modified this model while you were editing (Version {mdl?.version}).
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    className="flex-1 h-9 rounded-lg bg-obsidian-surface-high text-obsidian-on-surface text-xs font-bold hover:bg-obsidian-surface-highest transition-colors"
                                    onClick={() => resolveConflict('reload')}
                                >
                                    Discard & Reload
                                </button>
                                <button
                                    className="flex-1 h-9 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                                    onClick={() => resolveConflict('overwrite')}
                                >
                                    Force Overwrite
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex items-center justify-between px-6 h-12 bg-obsidian-surface-low border-b border-obsidian-outline-variant/10">
                <div className="flex items-center gap-3">
                    <Icon name="schema" size="md" className="text-obsidian-primary" />
                    <div>
                        <h1 className="text-sm font-bold text-obsidian-on-surface">Modeling Studio</h1>
                        <p className="font-label text-[9px] uppercase tracking-[0.15em] text-obsidian-on-surface-variant">
                            v{mdl?.version || 0} · {mdl?.content?.models?.length || 0} models · {mdl?.content?.relationships?.length || 0} relationships
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {suggestions.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-label font-bold rounded border border-amber-500/20">
                            {suggestions.length} pending
                        </span>
                    )}

                    <button
                        onClick={generateSuggestions}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high transition-colors disabled:opacity-50"
                    >
                        <Icon name={isGenerating ? "progress_activity" : "auto_awesome"} size="sm" className={isGenerating ? "animate-spin" : ""} />
                        <span className="hidden sm:inline">Suggest</span>
                    </button>

                    {hasLock ? (
                        <>
                            <button
                                onClick={() => saveMDL(false)}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-primary-container text-obsidian-surface text-xs font-bold hover:bg-obsidian-primary transition-colors disabled:opacity-50"
                            >
                                <Icon name={isSaving ? "progress_activity" : "save"} size="sm" className={isSaving ? "animate-spin" : ""} />
                                Save
                            </button>
                            <button
                                onClick={releaseLock}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-obsidian-on-surface-variant text-xs hover:bg-obsidian-surface-mid transition-colors"
                            >
                                <Icon name="lock_open" size="sm" />
                                <span className="hidden sm:inline">Unlock</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={acquireLock}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high transition-colors"
                        >
                            <Icon name="lock" size="sm" />
                            {mdl?.is_locked ? `Locked by ${mdl.locked_by}` : 'Edit Model'}
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal">
                    {/* Left: Schema Graph */}
                    <ResizablePanel defaultSize={65} minSize={40}>
                        <div className="h-full">
                            <SchemaGraph
                                models={mdl?.content?.models || []}
                                relationships={mdl?.content?.relationships || []}
                                onNodeSelect={setSelectedNode}
                                selectedNode={selectedNode}
                            />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle className="w-px bg-obsidian-outline-variant/15 hover:bg-obsidian-primary/50 transition-colors" />

                    {/* Right: Properties + Suggestions */}
                    <ResizablePanel defaultSize={35} minSize={25}>
                        <div className="h-full flex flex-col bg-obsidian-surface-low">
                            {/* Panel Tabs */}
                            <div className="flex border-b border-obsidian-outline-variant/10">
                                <button
                                    className={`flex-1 h-10 text-xs font-label uppercase tracking-wider font-bold transition-colors ${
                                        activePanel === 'properties'
                                            ? 'text-obsidian-primary border-b-2 border-obsidian-primary'
                                            : 'text-obsidian-on-surface-variant hover:text-obsidian-on-surface'
                                    }`}
                                    onClick={() => setActivePanel('properties')}
                                >
                                    Properties
                                </button>
                                <button
                                    className={`flex-1 h-10 text-xs font-label uppercase tracking-wider font-bold transition-colors flex items-center justify-center gap-1.5 ${
                                        activePanel === 'suggestions'
                                            ? 'text-obsidian-secondary-purple border-b-2 border-obsidian-secondary-purple'
                                            : 'text-obsidian-on-surface-variant hover:text-obsidian-on-surface'
                                    }`}
                                    onClick={() => setActivePanel('suggestions')}
                                >
                                    AI Suggestions
                                    {suggestions.length > 0 && (
                                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] rounded font-bold">
                                            {suggestions.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Panel Content */}
                            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                                {activePanel === 'properties' ? (
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
                                ) : (
                                    <div className="space-y-3">
                                        {suggestions.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Icon name="auto_awesome" size="lg" className="text-obsidian-outline mx-auto mb-3" />
                                                <p className="text-sm text-obsidian-on-surface-variant">No pending suggestions</p>
                                                <p className="text-xs text-obsidian-outline mt-1">Click "Suggest" to analyze schema</p>
                                            </div>
                                        ) : (
                                            suggestions.map((suggestion) => (
                                                <div key={suggestion.id} className="bg-obsidian-surface-mid rounded-lg border border-obsidian-outline-variant/10 p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span
                                                            className={`px-1.5 py-0.5 text-[9px] font-label font-bold rounded ${
                                                                suggestion.confidence >= 0.7
                                                                    ? 'bg-obsidian-primary/10 text-obsidian-primary'
                                                                    : suggestion.confidence >= 0.5
                                                                        ? 'bg-amber-500/10 text-amber-400'
                                                                        : 'bg-obsidian-surface-high text-obsidian-outline'
                                                            }`}
                                                        >
                                                            {Math.round(suggestion.confidence * 100)}% match
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-obsidian-on-surface-variant mb-3 leading-relaxed">
                                                        <code className="bg-obsidian-surface-high px-1 rounded text-obsidian-secondary-purple font-label text-[11px]">
                                                            {suggestion.from_table}.{suggestion.from_column}
                                                        </code>
                                                        <span className="mx-1.5 text-obsidian-outline">→</span>
                                                        <code className="bg-obsidian-surface-high px-1 rounded text-obsidian-secondary-purple font-label text-[11px]">
                                                            {suggestion.to_table}.{suggestion.to_column}
                                                        </code>
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleSuggestionAction(suggestion.id, 'confirm')}
                                                            className="flex-1 h-7 rounded bg-obsidian-primary/15 text-obsidian-primary text-[10px] font-label font-bold uppercase tracking-wider hover:bg-obsidian-primary/25 transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => handleSuggestionAction(suggestion.id, 'reject')}
                                                            className="flex-1 h-7 rounded bg-obsidian-surface-high text-obsidian-on-surface-variant text-[10px] font-label font-bold uppercase tracking-wider hover:text-red-400 transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
