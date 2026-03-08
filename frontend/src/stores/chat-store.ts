import { create } from "zustand";

type SetStateAction<T> = T | ((prev: T) => T);

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  isDangerous?: boolean;
  sql_query?: string;
  timestamp?: string;
}

interface ChatState {
  messages: ChatMessage[];
  currentConversationId: string | null;
  isLoading: boolean;

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: SetStateAction<ChatMessage[]>) => void;
  setCurrentConversationId: (id: SetStateAction<string | null>) => void;
  setIsLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your AI Database Analyst. Ask me anything about your data – I can query, analyze, and even help you make changes safely.",
  },
];

export const useChatStore = create<ChatState>((set) => ({
  messages: initialMessages,
  currentConversationId: null,
  isLoading: false,

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function"
          ? (messages as (prev: ChatMessage[]) => ChatMessage[])(state.messages)
          : messages,
    })),

  setCurrentConversationId: (currentConversationId) =>
    set((state) => ({
      currentConversationId:
        typeof currentConversationId === "function"
          ? (currentConversationId as (prev: string | null) => string | null)(
              state.currentConversationId,
            )
          : currentConversationId,
    })),

  setIsLoading: (isLoading) => set({ isLoading }),
  clearMessages: () => set({ messages: initialMessages }),
}));
