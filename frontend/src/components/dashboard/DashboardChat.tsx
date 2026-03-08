import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage, DashboardPlan, PlanningResponse } from "@/types/dashboard";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, CheckCircle2 } from "lucide-react";

interface DashboardChatProps {
    onPlanReady: (plan: DashboardPlan) => void;
    onGenerateDashboard: (connectionIds: string[]) => void;
    currentPlan: DashboardPlan | null;
}

const INITIAL_MESSAGE: ChatMessage = {
    id: "1",
    role: "assistant",
    content: "Hi! I'm your AI Dashboard Builder. What kind of dashboard would you like to create? Try saying:\n\n• \"Build me a marketing dashboard\"\n• \"Create a sales performance dashboard\"\n• \"Show me user analytics\"",
};

export function DashboardChat({ onPlanReady, onGenerateDashboard, currentPlan }: DashboardChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // Fetch available connections
        apiFetch<{ id: string, name: string }[]>("/api/v1/connections/", { auth: true })
            .then(data => setConnections(data))
            .catch(err => console.error("Failed to fetch connections", err));
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

        // Enforce data source selection
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

        try {
            const response = await apiFetch<PlanningResponse>("/api/v1/dashboards/planning", {
                method: "POST",
                body: JSON.stringify({
                    query: currentInput,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    connection_ids: selectedConnectionIds
                }),
                auth: true
            });

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
        } catch (e) {
            console.error("Planning failed", e);
            setMessages(prev => [...prev, {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: "I encountered an error while planning. Please check your connection and try again."
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border/50 bg-card/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20">
                    <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold">Dashboard Builder</h2>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI-POWERED</span>
                </div>
            </div>

            {/* Connection Selector */}
            <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Data Context
                    </span>
                    <span className="text-xs font-medium text-foreground">
                        {selectedConnectionIds.length === 0
                            ? "No sources selected"
                            : `${selectedConnectionIds.length} source${selectedConnectionIds.length > 1 ? 's' : ''} active`}
                    </span>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors">
                            <Database className="w-3.5 h-3.5 text-primary" />
                            Sources
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 backdrop-blur-xl bg-card/80 border-border/50">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1.5 font-bold">
                            Select Data Sources
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-border/30" />
                        {connections.length === 0 ? (
                            <div className="px-2 py-3 text-xs text-muted-foreground italic">
                                No data sources found...
                            </div>
                        ) : (
                            connections.map(conn => (
                                <DropdownMenuCheckboxItem
                                    key={conn.id}
                                    checked={selectedConnectionIds.includes(conn.id)}
                                    onCheckedChange={() => toggleConnection(conn.id)}
                                    className="rounded-lg text-sm font-medium focus:bg-primary/10 focus:text-primary py-2 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        {selectedConnectionIds.includes(conn.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        {conn.name}
                                    </div>
                                </DropdownMenuCheckboxItem>
                            ))
                        )}
                        <DropdownMenuSeparator className="bg-border/30" />
                        <div className="px-2 py-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-[10px] uppercase font-bold text-primary hover:bg-primary/5"
                                onClick={() => setSelectedConnectionIds(connections.map(c => c.id))}
                            >
                                Select All
                            </Button>
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
                                "flex gap-3",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === "assistant" && (
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shrink-0 mt-1">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                                    message.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-card border border-border rounded-bl-md"
                                )}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed">
                                    {message.content}
                                    {message.isTyping && (
                                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
                                    )}
                                </p>
                            </div>
                            {message.role === "user" && (
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary shrink-0 mt-1">
                                    <User className="w-4 h-4 text-primary-foreground" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isThinking && !messages.some(m => m.isTyping) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                    >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-card border border-border rounded-2xl rounded-bl-md">
                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
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
                        <Button
                            onClick={() => onGenerateDashboard(selectedConnectionIds)}
                            className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 font-semibold"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate Dashboard
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-4 border-t border-border/50 bg-card/30">
                <div className="flex gap-2 items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your dashboard..."
                        className="flex-1 h-11 px-4 bg-background border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        disabled={isThinking}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                        size="icon"
                        className="h-11 w-11 rounded-xl shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
