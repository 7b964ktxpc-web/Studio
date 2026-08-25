export type RequestLifecycleStatus = 'SEARCHING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';

export type CreateRequestResult = {
  request_id: string;
  request_status: 'SEARCHING';
  expires_at: string;
  queued_count: number;
};

export type AnswerRequestResult = {
  answer_id: string;
  request_id: string;
  request_status: 'SEARCHING';
};

export type RequestSnapshot = {
  id: string;
  text: string;
  status: RequestLifecycleStatus;
  created_at: string;
  expires_at: string;
};

export type CreateRequestAdapter = {
  createRequest(input: {
    text: string;
    latitude: number;
    longitude: number;
  }): Promise<CreateRequestResult>;
};

export type AnswerRequestAdapter = {
  answerRequest(input: {
    requestId: string;
    answer: string;
  }): Promise<AnswerRequestResult>;
};

export type RequestSnapshotAdapter = {
  getMyRequest(requestId: string): Promise<RequestSnapshot>;
};

export type RequestAnswerFlow = {
  createRequest(input: {
    text: string;
    latitude: number;
    longitude: number;
  }): Promise<CreateRequestResult>;
  answerRequest(input: {
    requestId: string;
    answer: string;
  }): Promise<AnswerRequestResult>;
  refreshRequest(requestId: string): Promise<RequestSnapshot>;
};

export function createRequestAnswerFlow(deps: {
  create: CreateRequestAdapter;
  answer: AnswerRequestAdapter;
  snapshot: RequestSnapshotAdapter;
}): RequestAnswerFlow {
  return {
    createRequest(input) {
      return deps.create.createRequest(input);
    },

    answerRequest(input) {
      return deps.answer.answerRequest(input);
    },

    refreshRequest(requestId) {
      const normalized = requestId.trim();
      if (!normalized) throw new Error('Invalid request id');
      return deps.snapshot.getMyRequest(normalized);
    },
  };
}
