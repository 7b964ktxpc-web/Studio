export type RequestSnapshot = {
  id: string;
  text: string;
  status: 'SEARCHING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
  created_at: string;
  expires_at: string;
};

type SupabaseRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseLike = {
  auth?: { getUser?: () => Promise<{ data?: { user?: { id?: string } } }> };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResult<unknown>>;
};

const STATUSES = new Set(['SEARCHING', 'ANSWERED', 'EXPIRED', 'CANCELLED']);

function normalizeSnapshot(value: unknown): RequestSnapshot {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') throw new Error('Invalid request snapshot response');

  const record = row as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.text !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.created_at !== 'string' ||
    typeof record.expires_at !== 'string'
  ) {
    throw new Error('Invalid request snapshot response');
  }

  if (!STATUSES.has(record.status)) throw new Error('Unexpected request status');

  return {
    id: record.id,
    text: record.text,
    status: record.status as RequestSnapshot['status'],
    created_at: record.created_at,
    expires_at: record.expires_at,
  };
}

export function createSupabaseRequestSnapshotAdapter(client: SupabaseLike) {
  return {
    async getMyRequest(requestId: string): Promise<RequestSnapshot> {
      const normalized = requestId.trim();
      if (!normalized) throw new Error('Invalid request id');

      const user = await client.auth?.getUser?.();
      if (!user?.data?.user?.id) throw new Error('Authentication required');

      const result = await client.rpc('my_request', { p_request_id: normalized });
      if (result.error) throw new Error(result.error.message);
      return normalizeSnapshot(result.data);
    },
  };
}
