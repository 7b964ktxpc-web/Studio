export type CreateRequestResult = {
  request_id: string;
  request_status: 'SEARCHING';
  expires_at: string;
  queued_count: number;
};

type SupabaseRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseLike = {
  auth?: { getUser?: () => Promise<{ data?: { user?: { id?: string } } }> };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResult<unknown>>;
};

const MAX_TEXT = 160;

function validateCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Invalid latitude');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Invalid longitude');
  }
}

function normalizeResult(value: unknown): CreateRequestResult {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') throw new Error('Invalid create request response');

  const record = row as Record<string, unknown>;
  if (typeof record.request_id !== 'string' || typeof record.expires_at !== 'string') {
    throw new Error('Invalid create request response');
  }

  if (record.request_status !== 'SEARCHING') {
    throw new Error('Unexpected request status');
  }

  const queued = Number(record.queued_count);
  if (!Number.isInteger(queued) || queued < 0 || queued > 8) {
    throw new Error('Invalid notification queue count');
  }

  return {
    request_id: record.request_id,
    request_status: 'SEARCHING',
    expires_at: record.expires_at,
    queued_count: queued,
  };
}

export function createSupabaseRequestAdapter(client: SupabaseLike) {
  return {
    async createRequest(input: {
      text: string;
      latitude: number;
      longitude: number;
    }): Promise<CreateRequestResult> {
      const text = input.text.trim();
      if (!text || text.length > MAX_TEXT) throw new Error('Invalid request text');

      validateCoordinates(input.latitude, input.longitude);

      const user = await client.auth?.getUser?.();
      if (!user?.data?.user?.id) throw new Error('Authentication required');

      const result = await client.rpc('create_request', {
        p_text: text,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
      });

      if (result.error) throw new Error(result.error.message);
      return normalizeResult(result.data);
    },
  };
}
