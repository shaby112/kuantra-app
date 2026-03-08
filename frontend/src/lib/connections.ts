
import { apiFetch } from "@/lib/api";

export type ConnectionResponse = {
  id: string;
  name: string;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  connection_uri: string | null;
  connection_type: "postgres" | "file";
  file_path: string | null;
};

export type ConnectionCreate = {
  name: string;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  connection_uri?: string | null;
  connection_type?: "postgres" | "mysql" | "mongodb" | "file";
  file_path?: string | null;
};

export type ConnectionUpdate = Partial<ConnectionCreate>;

export type TestConnectionRequest = {
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  connection_uri?: string | null;
};

export type ExecuteRequest = {
  sql: string;
  bypass_safety?: boolean;
};

export type ExecuteResponse = {
  sql_executed: string;
  row_count: number;
  results: any[];
};

export type QueryHistoryResponse = {
  id: string;
  sql_query: string;
  row_count: number;
  execution_time_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export type TableSchema = {
  table: string;
  columns: { name: string; type: string }[];
};

export async function uploadFile(file: File): Promise<ConnectionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<ConnectionResponse>("/api/v1/connections/upload", {
    method: "POST",
    body: formData,
    auth: true,
  });
}

export async function getConnections(): Promise<ConnectionResponse[]> {
  return apiFetch<ConnectionResponse[]>("/api/v1/connections/", { auth: true });
}

export async function createConnection(data: ConnectionCreate): Promise<ConnectionResponse> {
  return apiFetch<ConnectionResponse>("/api/v1/connections/", {
    method: "POST",
    body: JSON.stringify(data),
    auth: true,
  });
}

export async function updateConnection(id: string, data: ConnectionUpdate): Promise<ConnectionResponse> {
  return apiFetch<ConnectionResponse>(`/api/v1/connections/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    auth: true,
  });
}

export async function deleteConnection(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/connections/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function testConnectionParams(data: TestConnectionRequest): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/api/v1/connections/test", {
    method: "POST",
    body: JSON.stringify(data),
    auth: true,
  });
}

export async function getConnectionSchema(id: string): Promise<TableSchema[]> {
  return apiFetch<TableSchema[]>(`/api/v1/connections/${id}/schema`, { auth: true });
}

export async function executeQuery(id: string, request: ExecuteRequest): Promise<ExecuteResponse> {
  return apiFetch<ExecuteResponse>(`/api/v1/connections/${id}/execute`, {
    method: "POST",
    body: JSON.stringify(request),
    auth: true,
  });
}

export async function getTableData(id: string, tableName: string): Promise<ExecuteResponse> {
  return apiFetch<ExecuteResponse>(`/api/v1/connections/${id}/table/${tableName}`, { auth: true });
}

export async function getQueryHistory(id: string): Promise<QueryHistoryResponse[]> {
  return apiFetch<QueryHistoryResponse[]>(`/api/v1/connections/${id}/history`, { auth: true });
}

export async function testConnection(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await getConnectionSchema(id);
    return { success: true, message: "Connection successful" };
  } catch (e: any) {
    return { success: false, message: e.message || "Connection failed" };
  }
}

// --- Sync API Types ---

export type SyncTriggerResponse = {
  job_id: string;
  connection_id: string;
  status: string;
  message: string;
};

export type SyncStatusResponse = {
  connection_id: string;
  status: "never" | "success" | "failed" | "running";
  last_sync_at: string | null;
  rows_cached: number;
  tables_cached: string[];
  is_syncing: boolean;
  progress: number;
  error: string | null;
};

export type SyncProgressResponse = {
  job_id: string;
  status: string;
  progress: number;
  rows_synced: number;
  tables_completed: string[];
  tables_pending: string[];
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

export type SyncConfigUpdate = {
  sync_interval_minutes?: number;
  is_auto_sync_enabled?: boolean;
};

export type SyncConfigResponse = {
  connection_id: string;
  sync_interval_minutes: number;
  is_auto_sync_enabled: boolean;
};

// --- Sync API Functions ---

export async function triggerSync(connectionId: string, incremental: boolean = true): Promise<SyncTriggerResponse> {
  return apiFetch<SyncTriggerResponse>(`/api/v1/sync/${connectionId}?incremental=${incremental}`, {
    method: "POST",
    auth: true,
  });
}

export async function getAllSyncStatuses(): Promise<SyncStatusResponse[]> {
  return apiFetch<SyncStatusResponse[]>("/api/v1/sync/statuses", { auth: true });
}

export async function syncAllConnections(incremental: boolean = true): Promise<SyncTriggerResponse[]> {
  return apiFetch<SyncTriggerResponse[]>(`/api/v1/sync/all?incremental=${incremental}`, {
    method: "POST",
    auth: true,
  });
}

export async function getSyncStatus(connectionId: string): Promise<SyncStatusResponse> {
  return apiFetch<SyncStatusResponse>(`/api/v1/sync/${connectionId}/status`, { auth: true });
}

export async function getSyncProgress(connectionId: string): Promise<SyncProgressResponse> {
  return apiFetch<SyncProgressResponse>(`/api/v1/sync/${connectionId}/progress`, { auth: true });
}

export async function updateSyncConfig(connectionId: string, config: SyncConfigUpdate): Promise<SyncConfigResponse> {
  return apiFetch<SyncConfigResponse>(`/api/v1/sync/${connectionId}/config`, {
    method: "PUT",
    body: JSON.stringify(config),
    auth: true,
  });
}

export async function cancelSync(connectionId: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/api/v1/sync/${connectionId}/cancel`, {
    method: "POST",
    auth: true,
  });
}
