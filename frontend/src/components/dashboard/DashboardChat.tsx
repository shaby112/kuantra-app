import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import type { ChatMessage, DashboardPlan, PlanningResponse } from "@/types/dashboard";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore } from "@/stores/dashboard-store";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardChatProps {
    onPlanReady: (plan: DashboardPlan) => void;
    onGenerateDashboard: (connectionIds: string[]) => void;
    currentPlan: DashboardPlan | null;
}

export function DashboardChat({ onPlanReady, onGenerateDashboard, currentPlan }: DashboardChatProps) {
    // Messages persisted in Zustand store (survive tab switches)
    const messages = useDashboardStore((s) => s.chatMessages);
    const setMessages = useDashboardStore((s) => s.setChatMessages);

    const [input, setInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const [connections, setConnections] = useState<{ id: string, name: string }[]>([]);
    const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);

    const toggleConnection = (id: string) => {
        setSelectedConnectionIds(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Track in-flight request so we can ignore stale responses
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        apiFetch<{ id: string, name: string }[]>("/api/v1/connections/", { auth: true })
            .then(data => {
                setConnections(data);
                if (data.length > 0 && selectedConnectionIds.length === 0) {
                    setSelectedConnectionIds(data.map(c => c.id));
                }
            })
            .catch(err => console.error("Failed to fetch connections", err));
    }, []);

    // Clean up in-flight request on unmount (but don't clear messages)
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const simulateTyping = async (text: string, messageId: string) => {
        let currentText = "";
        for (let i = 0; i < text.length; i++) {
            currentText += text[i];
            setMessages(prev =>
                prev.map(m => m.id === messageId ? { ...m, content: currentText, isTyping: true } : m)
            );
            await new Promise(r => setTimeout(r, 15 + Math.random() * 20));
        }
        setMessages(prev =>
            prev.map(m => m.id === messageId ? { ...m, isTyping: false } : m)
        );
    };

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input,
        };

        if (connections.length > 0 && selectedConnectionIds.length === 0) {
            setMessages(prev => [...prev, userMessage]);
            setInput("");

            const botMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, {
                id: botMsgId,
                role: "assistant",
                content: "Please select at least one data source from the menu above so I know which data to use.",
                isTyping: false
            }]);
            return;
        }

        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput("");
        setIsThinking(true);

        // Abort any previous in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const response = await apiFetch<PlanningResponse>("/api/v1/dashboards/planning", {
                method: "POST",
                body: JSON.stringify({
                    query: currentInput,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    connection_ids: selectedConnectionIds
                }),
                auth: true,
                signal: controller.signal,
            });

            // If aborted (tab switch etc.), don't update state
            if (controller.signal.aborted) return;

            const aiMessageId = (Date.now() + 1).toString();

            if (response.status === "clarifying" && response.question) {
                setMessages(prev => [...prev, { id: aiMessageId, role: "assistant", content: "", isTyping: true }]);
                await simulateTyping(response.question, aiMessageId);
            } else if (response.status === "ready" && response.plan) {
                const plan = response.plan;
                const responseText = `I've prepared a plan for "${plan.title}".\n\nMetrics: ${plan.metrics.map(m => m.name).join(", ")}\nVisualizations: ${plan.visualizations.length}\n\nClick "Generate Dashboard" when you're ready!`;

                setMessages(prev => [...prev, { id: aiMessageId, role: "assistant", content: "", isTyping: true }]);
                await simulateTyping(responseText, aiMessageId);
                onPlanReady(plan);
            }
        } catch (e: any) {
            if (e?.name === "AbortError") return;
            console.error("Planning failed", e);
            setMessages(prev => [...prev, {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: "I encountered an error while planning. Please check your connection and try again."
            }]);
        } finally {
            if (!controller.signal.aborted) {
                setIsThinking(false);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-obsidian-surface">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-obsidian-outline-variant/10 bg-obsidian-surface-low">
                <Icon name="auto_awesome" size="sm" className="text-obsidian-primary" />
                <div>
                    <h2 className="text-sm font-bold text-obsidian-on-surface">Dashboard Builder</h2>
                    <span className="font-label text-[9px] uppercase tracking-[0.15em] text-obsidian-on-surface-variant">AI-Powered</span>
                </div>
            </div>

            {/* Connection Selector */}
            <div className="px-4 py-2.5 border-b border-obsidian-outline-variant/10 bg-obsidian-surface-low/50 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                    <span className="font-label text-[9px] uppercase tracking-[0.15em] text-obsidian-outline font-bold">
                        Data Context
                    </span>
                    <span className="text-xs font-medium text-obsidian-on-surface">
                        {selectedConnectionIds.length === 0
                            ? "No sources selected"
                            : `${selectedConnectionIds.length} source${selectedConnectionIds.length > 1 ? 's' : ''} active`}
                    </span>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs hover:bg-obsidian-surface-high transition-colors border border-obsidian-outline-variant/15">
                            <Icon name="database" size="sm" className="text-obsidian-primary" />
                            <span className="font-label text-[10px] tracking-wider">Sources</span>
                            <Icon name="expand_more" size="sm" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 bg-obsidian-surface-mid border-obsidian-outline-variant/20">
                        <DropdownMenuLabel className="font-label text-[9px] uppercase tracking-[0.15em] text-obsidian-outline px-2 py-1.5 font-bold">
                            Select Data Sources
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-obsidian-outline-variant/15" />
                        {connections.length === 0 ? (
                            <div className="px-2 py-3 text-xs text-obsidian-on-surface-variant italic">
                                No data sources found...
                            </div>
                        ) : (
                            connections.map(conn => (
                                <DropdownMenuCheckboxItem
                                    key={conn.id}
                                    checked={selectedConnectionIds.includes(conn.id)}
                                    onCheckedChange={() => toggleConnection(conn.id)}
                                    className="rounded-lg text-sm font-medium py-2 cursor-pointer"
                                >
                                    {conn.name}
                                </DropdownMenuCheckboxItem>
                            ))
                        )}
                        <DropdownMenuSeparator className="bg-obsidian-outline-variant/15" />
                        <div className="px-2 py-2">
                            <button
                                className="w-full h-7 text-obsidian-primary font-label text-[10px] uppercase tracking-wider font-bold hover:bg-obsidian-primary/5 rounded-lg transition-colors"
                                onClick={() => setSelectedConnectionIds(connections.map(c => c.id))}
                            >
                                Select All
                            </button>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                <AnimatePresence initial={false}>
                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                                "flex gap-2.5",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === "assistant" && (
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-obsidian-surface-mid shrink-0 mt-1">
                                    <Icon name="smart_toy" size="sm" className="text-obsidian-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm",
                                    message.role === "user"
                                        ? "bg-obsidian-primary/15 text-obsidian-on-surface rounded-br-sm"
                                        : "bg-obsidian-surface-mid text-obsidian-on-surface rounded-bl-sm"
                                )}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed text-[13px]">
                                    {message.content}
                                    {message.isTyping && (
                                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-obsidian-primary animate-pulse" />
                                    )}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isThinking && !messages.some(m => m.isTyping) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-2.5"
                    >
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-obsidian-surface-mid shrink-0">
                            <Icon name="smart_toy" size="sm" className="text-obsidian-primary" />
                        </div>
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-obsidian-surface-mid rounded-lg rounded-bl-sm">
                            <div className="w-1.5 h-1.5 bg-obsidian-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-obsidian-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-obsidian-primary/60 rounded-full animate-bounce" />
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Generate Button */}
            <AnimatePresence>
                {currentPlan && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="px-4 pb-2"
                    >
                        <button
                            onClick={() => onGenerateDashboard(selectedConnectionIds)}
                            className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-obsidian-primary-container text-obsidian-surface font-bold text-sm hover:bg-obsidian-primary transition-colors"
                        >
                            <Icon name="auto_awesome" size="sm" />
                            Generate Dashboard
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-3 border-t border-obsidian-outline-variant/10">
                <div className="flex gap-2 items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your dashboard..."
                        className="flex-1 h-10 px-4 bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 rounded-lg text-sm font-label tracking-wider text-obsidian-on-surface placeholder:text-obsidian-outline/40 focus:outline-none focus:border-obsidian-primary transition-all"
                        disabled={isThinking}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                        className="h-10 w-10 rounded-lg bg-obsidian-primary-container text-obsidian-surface flex items-center justify-center hover:bg-obsidian-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Icon name="send" size="sm" />
                    </button>
                </div>
            </div>
        </div>
    );
}
