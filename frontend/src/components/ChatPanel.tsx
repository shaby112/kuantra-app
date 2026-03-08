import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Database, Search, MessageSquare, Plus, ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Conversation History State
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

      // Add welcome message at the start if no messages
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
        content: "Hello! I'm your AI Database Analyst. Ask me anything about your data – I can query, analyze, and even help you make changes safely.",
      },
    ]);
    setCurrentConversationId(null);
    setShowHistory(false);
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/v1/conversations/${conversationId}`, {
        method: "DELETE",
        auth: true
      });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setShowAtMenu(false);
    setIsThinking(true);

    const aiMessageId = (Date.now() + 1).toString();

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Missing authentication token");
      }
      // CRITICAL FIX: Ensure we use the latest conversation ID from state
      const conversationParam = currentConversationId ? `&conversation_id=${encodeURIComponent(currentConversationId)}` : "";

      const response = await fetch(
        `${API_BASE_URL}/api/v1/chat/stream?query=${encodeURIComponent(currentInput)}${conversationParam}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Temporary buffer to hold partial JSON chunks
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Split by double newline which typically separates SSE events
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep the incomplete part in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ")) {
            try {
              const dataStr = trimmedLine.slice(6);
              if (!dataStr) continue;
              const data = JSON.parse(dataStr);

              // Handle conversation ID from backend
              if (data.type === "conversation") {
                console.log("Conversation established:", data.conversation_id);
                setCurrentConversationId(String(data.conversation_id));
                // Refresh list silently
                apiFetch<Conversation[]>("/api/v1/conversations/", { auth: true })
                  .then(setConversations)
                  .catch(console.error);
              } else if (data.type === "text") {
                let content = data.content || "";
                // Filter out tool_outputs and internal messages if any leaked
                if (content.includes("```tool_outputs") ||
                  content.includes("execute_sql_tool_response") ||
                  content.includes("Connection ID")) {
                  continue;
                }

                assistantContent += content;
                setMessages((prev) => {
                  const existing = prev.find(m => m.id === aiMessageId);
                  if (existing) {
                    return prev.map(m => m.id === aiMessageId ? { ...m, content: assistantContent } : m);
                  } else {
                    return [...prev, { id: aiMessageId, role: "assistant", content: assistantContent }];
                  }
                });
              } else if (data.type === "status") {
                // For status messages, we can maybe show a small toast or indicator, but avoid cluttering logic
                if (data.sql) {
                  setMessages((prev) => {
                    const existing = prev.find(m => m.id === aiMessageId);
                    if (existing) {
                      return prev.map(m => m.id === aiMessageId ? { ...m, sql: data.sql } : m);
                    } else {
                      return [...prev, { id: aiMessageId, role: "assistant", content: "", sql: data.sql }];
                    }
                  });
                }
              } else if (data.type === "error") {
                // Suppress connection ID errors
                if (!data.content.includes("Connection ID")) {
                  assistantContent += "\n\n*I encountered a slight issue processing that request.*";
                  setMessages((prev) => {
                    const existing = prev.find(m => m.id === aiMessageId);
                    if (existing) {
                      return prev.map(m => m.id === aiMessageId ? { ...m, content: assistantContent } : m);
                    }
                    return [...prev, { id: aiMessageId, role: "assistant", content: assistantContent }];
                  });
                }
              }
            } catch (e) {
              console.error("Error parsing SSE chunk", e);
            }
          }
        }
      }
    } catch (e: any) {
      setMessages((prev) =>
        prev.map(m => m.id === aiMessageId ? { ...m, content: e?.message || "Connection lost" } : m)
      );
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
    let cleanContent = content
      .replace(/```tool_outputs[\s\S]*?```/g, '')
      .replace(/\{"execute_sql_tool_response"[\s\S]*?\}/g, '')
      .trim();
    if (!cleanContent) return null;

    const parts = cleanContent.split(/(@\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("@[") && part.endsWith("]")) {
        const dbName = part.slice(2, -1);
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-xs transform translate-y-[-1px]",
              isUser
                ? "bg-white/20 text-white border border-white/30"
                : "bg-primary/10 text-primary border border-primary/20"
            )}
          >
            <Database className="w-3 h-3" />
            {dbName}
          </span>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  function handleSelectDatabase(name: string) {
    // Insert safely at cursor position or append logic
    const inputEl = inputRef.current;
    if (!inputEl) return;

    const cursorPs = inputEl.selectionStart || 0;
    const textBefore = input.slice(0, cursorPs);
    const textAfter = input.slice(cursorPs);

    // Find the last '@' before cursor
    const lastAtPos = textBefore.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const newText = textBefore.slice(0, lastAtPos) + `@[${name}] ` + textAfter;
      setInput(newText);

      // Restore focus and cursor (approximate end of insertion)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = lastAtPos + name.length + 4; // @ [ name ] space
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    setShowAtMenu(false);
  }

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {showHistory ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(false)}
              className="h-8 w-8 hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 ring-1 ring-primary/30">
              <Bot className="w-4 h-4 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {showHistory ? "Chat History" : "AI Analyst"}
            </h2>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {showHistory ? `${conversations.length} SAVED` : "ONLINE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  fetchConversations();
                  setShowHistory(true);
                }}
                className="h-8 w-8 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Chat History"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={startNewConversation}
                className="h-8 w-8 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <div className="p-4 rounded-full bg-muted/50">
                <MessageSquare className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm">No conversations yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={startNewConversation}
                className="hover:bg-primary/10 hover:text-primary transition-colors border-dashed"
              >
                Start a new chat
              </Button>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "group w-full flex items-center justify-between p-3 rounded-lg text-left transition-all cursor-pointer border border-transparent",
                  currentConversationId === conv.id
                    ? "bg-primary/10 border-primary/20 dark:bg-primary/20"
                    : "hover:bg-muted/50 hover:border-white/5"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors",
                    currentConversationId === conv.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-background"
                  )}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm font-medium truncate transition-colors",
                      currentConversationId === conv.id ? "text-primary" : "text-foreground group-hover:text-primary/80"
                    )}>{conv.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shrink-0 mt-1 shadow-sm">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] space-y-2",
                  message.role === "user" ? "items-end flex flex-col" : "items-start"
                )}>
                  <div className={cn(
                    "px-4 py-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                    message.role === "assistant"
                      ? "rounded-2xl rounded-tl-sm bg-card/80 border border-white/5 text-foreground dark:bg-white/5 dark:border-white/10"
                      : "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground shadow-primary/20"
                  )}>
                    {renderContent(message.content, message.role === "user")}
                  </div>
                  {message.sql && (
                    <div className="w-full max-w-md transform transition-all hover:translate-y-[-2px]">
                      <SQLPreviewCard
                        sql={message.sql}
                        isDangerous={message.isDangerous}
                        onExecute={() => handleExecute(message.sql!)}
                        onReview={() => onOpenDangerModal(message.sql!)}
                      />
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary shrink-0 mt-1">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isThinking && !messages.some(m => m.role === 'assistant' && m.id !== '1' && (m.content || m.sql)) && (
              <div className="flex gap-4 px-1 animate-in fade-in duration-500">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0 mt-1">
                  <ThinkingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/5 bg-background/30 backdrop-blur-md relative z-10">
            {/* @ Mention Menu */}
            {showAtMenu && connections.length > 0 && (
              <div
                className="absolute bottom-full left-4 mb-2 w-72 bg-popover/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 animate-in zoom-in-95 duration-200"
              >
                <div className="px-3 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Database</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Use arrow keys</span>
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
                          ? "bg-primary/10 text-primary border-l-2 border-primary pl-[10px]"
                          : "hover:bg-white/5 text-foreground border-l-2 border-transparent"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                        focusedConnIndex === idx ? "bg-primary text-primary-foreground" : "bg-muted/50"
                      )}>
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate min-w-0 flex-1">
                        <p className="text-sm font-medium leading-none mb-1">{conn.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate opacity-70">{conn.host || 'Direct URI'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative group bg-secondary/50 rounded-xl border border-white/5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all shadow-inner">
              {/* Highlight Overlay (Underlay) */}
              <div
                aria-hidden="true"
                className="absolute inset-0 px-3 py-3 text-sm font-sans pointer-events-none whitespace-pre-wrap break-words z-0 overflow-hidden"
                style={{ minHeight: '44px' }}
              >
                {input ? (
                  input.split(/(@\[[^\]]+\])/g).map((part, i) => {
                    if (part.startsWith("@[") && part.endsWith("]")) {
                      const dbName = part.slice(2, -1);
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 -my-0.5 mx-0.5 rounded bg-primary/20 text-primary text-xs font-bold border border-primary/30 align-middle"
                        >
                          <Database className="w-3 h-3 mr-1" />
                          {dbName}
                        </span>
                      );
                    }
                    return <span key={i} className="text-foreground">{part}</span>;
                  })
                ) : (
                  <span className="text-muted-foreground/60">Ask insight... type @ to tag a database</span>
                )}
                {/* Invisible character to maintain height if empty or trailing newline */}
                <span className="invisible">&#8203;</span>
              </div>

              {/* Transparent Textarea (Input) */}
              <div className="flex items-end gap-2 p-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInput(val);

                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;

                    // Smarter trigger detection
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
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setFocusedConnIndex((prev) => (prev + 1) % connections.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setFocusedConnIndex((prev) => (prev - 1 + connections.length) % connections.length);
                      } else if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        handleSelectDatabase(connections[focusedConnIndex].name);
                      } else if (e.key === "Escape") {
                        setShowAtMenu(false);
                      }
                    } else if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="w-full min-h-[44px] max-h-[200px] px-3 py-2 text-sm bg-transparent text-transparent caret-foreground resize-none focus:outline-none z-10 font-sans leading-relaxed selection:bg-primary/20 overflow-hidden"
                  spellCheck={false}
                  rows={1}
                  style={{ lineHeight: 'inherit' }}
                />

                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  className={cn(
                    "h-8 w-8 mb-1 shrink-0 transition-all duration-300 z-20",
                    input.trim()
                      ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 scale-100"
                      : "bg-muted text-muted-foreground scale-90 opacity-70"
                  )}
                >
                  <div className={cn("transition-all", isThinking ? "animate-spin" : "")}>
                    {isThinking ? <Search className="w-4 h-4" /> : <Send className="w-4 h-4 ml-0.5" />}
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
