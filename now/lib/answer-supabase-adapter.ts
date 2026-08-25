export type AnswerRequestResult = {
  answer_id: string;
  request_id: string;
  request_status: 'SEARCHING';
};

type SupabaseRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseLike = {
  auth?: { getUser?: () => Promise<{ data?: { user?: { id?: string } } }> };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResult<unknown>>;
};

const MAX_ANSWER = 240;

function normalizeResult(value: unknown): AnswerRequestResult {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') throw new Error('Invalid answer response');

  const record = row as Record<string, unknown>;
  if (typeof record.answer_id !== 'string' || typeof record.request_id !== 'string') {
    throw new Error('Invalid answer response');
  }

  if (record.request_status !== 'SEARCHING') {
    throw new Error('Unexpected request status');
  }

  return {
    answer_id: record.answer_id,
    request_id: record.request_id,
    request_status: 'SEARCHING',
  };
}

export function createSupabaseAnswerAdapter(client: SupabaseLike) {
  return {
    async answerRequest(input: {
      requestId: string;
      answer: string;
    }): Promise<AnswerRequestResult> {
      const requestId = input.requestId.trim();
      const answer = input.answer.trim();

      if (!requestId) throw new Error('Invalid request id');
      if (!answer || answer.length > MAX_ANSWER) throw new Error('Invalid answer');

      const user = await client.auth?.getUser?.();
      if (!user?.data?.user?.id) throw new Error('Authentication required');

      const result = await client.rpc('answer_request', {
        p_request_id: requestId,
        p_answer: answer,
      });

      if (result.error) throw new Error(result.error.message);
      return normalizeResult(result.data);
    },
  };
}
