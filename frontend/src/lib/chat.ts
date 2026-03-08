import { apiFetch } from "@/lib/api";

export type ChatMessageResponse = {
  content: string;
  sql?: string | null;
  isDangerous?: boolean;
};

export async function sendChatMessage(message: string): Promise<ChatMessageResponse> {
  return apiFetch<ChatMessageResponse>("/api/v1/chat/message", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function executeSql(sql: string, connection_id?: string): Promise<{ results: any[] }> {
  return apiFetch<{ results: any[] }>("/api/v1/chat/execute", {
    method: "POST",
    body: JSON.stringify({ sql, connection_id }),
    auth: true
  });
}
