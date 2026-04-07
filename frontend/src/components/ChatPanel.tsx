import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { SQLPreviewCard } from "@/components/SQLPreviewCard";
import { cn } from "@/lib/utils";
import { executeSql } from "@/lib/chat";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, apiFetch, getAuthToken } from "@/lib/api";
import { useGlobalState } from "@/context/GlobalStateContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  isDangerous?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatPanelProps {
  onDataUpdate: (data: any[]) => void;
  onOpenDangerModal: (sql: string) => void;
}

export function ChatPanel({ onDataUpdate, onOpenDangerModal }: ChatPanelProps) {
  const { toast } = useToast();
  const {
    chatMessages: messages,
    setChatMessages: setMessages,
    currentConversationId,
    setCurrentConversationId
  } = useGlobalState();

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [focusedConnIndex, setFocusedConnIndex] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchConnections();
    fetchConversations();
  }, []);

  const fetchConnections = async () => {
    try {
      const data = await apiFetch<any[]>("/api/v1/connections/", { auth: true });
      setConnections(data);
    } catch (e) {
      console.error("Failed to fetch connections", e);
    }
  };

  const fetchConversations = async () => {
    try {
      const data = await apiFetch<Conversation[]>("/api/v1/conversations/", { auth: true });
      setConversations(data);
    } catch (e) {
      console.error("Failed to fetch conversations", e);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const data = await apiFetch<any>(`/api/v1/conversations/${conversationId}`, { auth: true });
      const loadedMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        sql: msg.sql_query,
      }));
      if (loadedMessages.length === 0) {
        loadedMessages.unshift({
          id: "1",
          role: "assistant",
          content: "Hello! I'm your AI Database Analyst. Ask me anything about your data.",
        });
      }
      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
      setShowHistory(false);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load conversation", variant: "destructive" });
    }
  };

  const startNewConversation = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: "Hello! I'm your AI Database Analyst. Ask me anything about your data \u2013 I can query, analyze, and even help you make changes safely.",
      },
    ]);
    setCurrentConversationId(null);
    setShowHistory(false);
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/v1/conversations/${conversationId}`, { method: "DELETE", auth: true });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) startNewConversation();
      toast({ title: "Deleted", description: "Conversation removed" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setShowAtMenu(false);
    setIsThinking(true);
    const aiMessageId = (Date.now() + 1).toString();

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Missing authentication token");
      const conversationParam = currentConversationId ? `&conversation_id=${encodeURIComponent(currentConversationId)}` : "";
      const response = await fetch(
        `${API_BASE_URL}/api/v1/chat/stream?query=${encodeURIComponent(currentInput)}${conversationParam}`,
        { headers: { "Authorization": `Bearer ${token}` } }
      );
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ")) {
            try {
              const dataStr = trimmedLine.slice(6);
              if (!dataStr) continue;
              const data = JSON.parse(dataStr);

              if (data.type === "conversation") {
                setCurrentConversationId(String(data.conversation_id));
                apiFetch<Conversation[]>("/api/v1/conversations/", { auth: true }).then(setConversations).catch(console.error);
              } else if (data.type === "text") {
                let content = data.content || "";
                if (content.includes("```tool_outputs") || content.includes("execute_sql_tool_response") || content.includes("Connection ID")) continue;
                assistantContent += content;
                setMessages((prev) => {
                  const existing = prev.find(m => m.id === aiMessageId);
                  if (existing) return prev.map(m => m.id === aiMessageId ? { ...m, content: assistantContent } : m);
                  return [...prev, { id: aiMessageId, role: "assistant", content: assistantContent }];
                });
              } else if (data.type === "status" && data.sql) {
                setMessages((prev) => {
                  const existing = prev.find(m => m.id === aiMessageId);
                  if (existing) return prev.map(m => m.id === aiMessageId ? { ...m, sql: data.sql } : m);
                  return [...prev, { id: aiMessageId, role: "assistant", content: "", sql: data.sql }];
                });
              } else if (data.type === "error" && !data.content.includes("Connection ID")) {
                assistantContent += "\n\n*I encountered a slight issue processing that request.*";
                setMessages((prev) => {
                  const existing = prev.find(m => m.id === aiMessageId);
                  if (existing) return prev.map(m => m.id === aiMessageId ? { ...m, content: assistantContent } : m);
                  return [...prev, { id: aiMessageId, role: "assistant", content: assistantContent }];
                });
              }
            } catch (e) {
              console.error("Error parsing SSE chunk", e);
            }
          }
        }
      }
    } catch (e: any) {
      setMessages((prev) => prev.map(m => m.id === aiMessageId ? { ...m, content: e?.message || "Connection lost" } : m));
    } finally {
      setIsThinking(false);
    }
  };

  const handleExecute = async (sql: string) => {
    try {
      const resp = await executeSql(sql);
      onDataUpdate(resp.results || []);
      toast({ title: "Query Complete", description: `Returned ${resp.results?.length ?? 0} rows.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to execute", variant: "destructive" });
    }
  };

  const renderContent = (content: string, isUser: boolean = false) => {
    if (!content) return null;
    let cleanContent = content.replace(/```tool_outputs[\s\S]*?```/g, '').replace(/\{"execute_sql_tool_response"[\s\S]*?\}/g, '').trim();
    if (!cleanContent) return null;
    const parts = cleanContent.split(/(@\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("@[") && part.endsWith("]")) {
        const dbName = part.slice(2, -1);
        return (
          <span key={i} className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-xs",
            isUser ? "bg-white/20 text-white border border-white/30" : "bg-obsidian-primary/10 text-obsidian-primary border border-obsidian-primary/20"
          )}>
            <Icon name="database" size="sm" />
            {dbName}
          </span>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  function handleSelectDatabase(name: string) {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    const cursorPs = inputEl.selectionStart || 0;
    const textBefore = input.slice(0, cursorPs);
    const textAfter = input.slice(cursorPs);
    const lastAtPos = textBefore.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const newText = textBefore.slice(0, lastAtPos) + `@[${name}] ` + textAfter;
      setInput(newText);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = lastAtPos + name.length + 4;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    setShowAtMenu(false);
  }

  return (
    <div className="flex flex-col h-full bg-obsidian-surface-low">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-obsidian-outline-variant/15 bg-obsidian-surface-mid">
        <div className="flex items-center gap-3">
          {showHistory ? (
            <button onClick={() => setShowHistory(false)} className="text-obsidian-on-surface-variant hover:text-white transition-colors">
              <Icon name="arrow_back" />
            </button>
          ) : (
            <div className="p-2 bg-obsidian-primary/10 rounded-lg">
              <Icon name="smart_toy" className="text-obsidian-primary" />
            </div>
          )}
          <div>
            <h4 className="font-headline font-bold text-obsidian-on-surface">
              {showHistory ? "Chat History" : "Kuantra AI"}
            </h4>
            <p className="text-[10px] font-label text-obsidian-primary uppercase tracking-widest">
              {showHistory ? `${conversations.length} Saved` : "Online"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!showHistory && (
            <>
              <button
                onClick={() => { fetchConversations(); setShowHistory(true); }}
                className="p-2 text-obsidian-on-surface-variant hover:text-white transition-colors"
                title="Chat History"
              >
                <Icon name="history" size="sm" />
              </button>
              <button
                onClick={startNewConversation}
                className="p-2 text-obsidian-on-surface-variant hover:text-white transition-colors"
                title="New Chat"
              >
                <Icon name="add" size="sm" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
              <Icon name="chat_bubble_outline" className="text-4xl opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button
                onClick={startNewConversation}
                className="px-4 py-2 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 text-obsidian-on-surface font-label text-xs uppercase tracking-widest hover:bg-obsidian-primary/10 hover:text-obsidian-primary transition-all rounded-lg"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "group flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-all",
                  currentConversationId === conv.id
                    ? "bg-obsidian-primary/10 border-l-2 border-obsidian-primary"
                    : "hover:bg-obsidian-surface-highest/50"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon name="chat_bubble" size="sm" className={currentConversationId === conv.id ? "text-obsidian-primary" : "text-zinc-500"} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium truncate", currentConversationId === conv.id ? "text-obsidian-primary" : "text-white")}>{conv.title}</p>
                    <p className="text-[10px] text-zinc-500 font-label">
                      {new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-zinc-500 hover:text-obsidian-error"
                >
                  <Icon name="delete" size="sm" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {/* Session marker */}
            <div className="flex justify-center">
              <span className="font-label text-[9px] uppercase tracking-[0.2em] text-zinc-600 bg-obsidian-surface-lowest px-2 py-0.5 rounded">
                Current Session
              </span>
            </div>

            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-4", message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" && (
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-obsidian-primary-container flex items-center justify-center">
                    <Icon name="analytics" filled className="text-obsidian-surface" size="sm" />
                  </div>
                )}
                <div className={cn("max-w-[85%] space-y-2", message.role === "user" ? "items-end flex flex-col" : "items-start")}>
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2">
                      <span className="font-label text-[10px] uppercase tracking-widest text-obsidian-primary font-bold">Kuantra AI</span>
                      <span className="font-label text-[9px] text-zinc-600">Just Now</span>
                    </div>
                  )}
                  <div className={cn(
                    "px-4 py-3 text-sm leading-relaxed",
                    message.role === "assistant"
                      ? "chat-bubble-ai"
                      : "chat-bubble-user"
                  )}>
                    {renderContent(message.content, message.role === "user")}
                  </div>
                  {message.sql && (
                    <div className="w-full max-w-md">
                      <SQLPreviewCard
                        sql={message.sql}
                        isDangerous={message.isDangerous}
                        onExecute={() => handleExecute(message.sql!)}
                        onReview={() => onOpenDangerModal(message.sql!)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isThinking && !messages.some(m => m.role === 'assistant' && m.id !== '1' && (m.content || m.sql)) && (
              <div className="flex gap-4">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-obsidian-primary/10 flex items-center justify-center">
                  <ThinkingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-6 pb-2">
              <button
                onClick={() => { setInput("Show me active users"); handleSend(); }}
                className="px-3 py-1.5 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 rounded-full text-[11px] font-label text-zinc-400 hover:text-obsidian-primary transition-colors flex items-center gap-2"
              >
                <Icon name="query_stats" size="sm" />
                Show active users
              </button>
              <button
                onClick={() => { setInput("Monthly revenue growth"); handleSend(); }}
                className="px-3 py-1.5 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 rounded-full text-[11px] font-label text-zinc-400 hover:text-obsidian-primary transition-colors flex items-center gap-2"
              >
                <Icon name="payments" size="sm" />
                Monthly revenue growth
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-6 bg-obsidian-surface-lowest border-t border-obsidian-outline-variant/15 relative">
            {/* @ Mention Menu */}
            {showAtMenu && connections.length > 0 && (
              <div className="absolute bottom-full left-6 mb-2 w-72 glass-panel border border-obsidian-primary/20 rounded-lg shadow-2xl overflow-hidden z-20">
                <div className="px-3 py-2 border-b border-obsidian-outline-variant/15 flex items-center gap-2">
                  <Icon name="database" size="sm" className="text-obsidian-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-label">Select Database</span>
                </div>
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  {connections.map((conn, idx) => (
                    <button
                      key={conn.id}
                      onClick={() => handleSelectDatabase(conn.name)}
                      onMouseEnter={() => setFocusedConnIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all",
                        focusedConnIndex === idx
                          ? "bg-obsidian-primary/10 text-obsidian-primary border-l-2 border-obsidian-primary"
                          : "hover:bg-obsidian-surface-highest/50 text-white"
                      )}
                    >
                      <Icon name="database" size="sm" className={focusedConnIndex === idx ? "text-obsidian-primary" : "text-zinc-500"} />
                      <div className="truncate min-w-0 flex-1">
                        <p className="text-sm font-medium leading-none mb-0.5">{conn.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate font-label">{conn.host || 'Direct URI'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative flex items-center bg-obsidian-surface-mid px-4 py-3 rounded-lg border border-obsidian-outline-variant/40 group hover:border-obsidian-primary/50 focus-within:border-obsidian-primary transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                  const cursor = e.target.selectionStart || 0;
                  const textBefore = val.slice(0, cursor);
                  const lastWord = textBefore.split(/[\s\n]+/).pop() || "";
                  if (lastWord.startsWith('@') && !lastWord.includes(']')) {
                    setShowAtMenu(true);
                    setFocusedConnIndex(0);
                  } else {
                    setShowAtMenu(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (showAtMenu) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedConnIndex((p) => (p + 1) % connections.length); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedConnIndex((p) => (p - 1 + connections.length) % connections.length); }
                    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); handleSelectDatabase(connections[focusedConnIndex].name); }
                    else if (e.key === "Escape") setShowAtMenu(false);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-transparent border-none text-sm focus:ring-0 focus:outline-none text-obsidian-on-surface placeholder:text-zinc-600 resize-none min-h-[24px] max-h-[200px]"
                placeholder="Ask Kuantra AI..."
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="text-obsidian-primary disabled:text-zinc-600 transition-colors ml-2 shrink-0"
              >
                <Icon name={isThinking ? "hourglass_empty" : "send"} className={isThinking ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-[10px] font-label text-zinc-600 flex items-center gap-1">
                <Icon name="security" size="sm" />
                Read-only mode enabled
              </span>
              <div className="flex gap-2 items-center">
                <span className="w-2 h-2 rounded-full bg-obsidian-primary animate-pulse" />
                <span className="text-[10px] font-label text-obsidian-primary uppercase tracking-widest font-bold">Live Link</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
