export type SignalStatus = 'FREE' | 'SMALL' | 'LARGE' | 'UNKNOWN';

export type SignalAnswer = {
  id: string;
  text: string;
  createdAt: string;
};

export type SignalSummary = {
  status: SignalStatus;
  label: string;
  confidence: number;
  answerCount: number;
  freshAnswerCount: number;
};

const FRESH_MS = 10 * 60 * 1000;

const FREE_PATTERNS = [
  /нет\s+очеред/i,
  /без\s+очеред/i,
  /свободно/i,
  /пусто/i,
  /работа(?:ет|ет)?\s*норм/i,
  /есть\s+в\s+наличии/i,
];

const SMALL_PATTERNS = [
  /небольш/i,
  /маленьк/i,
  /пара\s+(?:человек|людей)/i,
  /до\s+10/i,
  /человек\s*5/i,
];

const LARGE_PATTERNS = [
  /больш/i,
  /длинн/i,
  /много/i,
  /огром/i,
  /стоит\s+толпа/i,
  /10\s*\+/i,
  /больше\s+10/i,
];

function classify(text: string): SignalStatus {
  const value = text.trim();
  if (!value) return 'UNKNOWN';
  if (LARGE_PATTERNS.some(pattern => pattern.test(value))) return 'LARGE';
  if (SMALL_PATTERNS.some(pattern => pattern.test(value))) return 'SMALL';
  if (FREE_PATTERNS.some(pattern => pattern.test(value))) return 'FREE';
  return 'UNKNOWN';
}

function isFresh(createdAt: string, now: number): boolean {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= FRESH_MS;
}

export function aggregateSignal(
  answers: SignalAnswer[],
  now = Date.now(),
): SignalSummary {
  const fresh = answers.filter(answer => isFresh(answer.createdAt, now));
  const counts: Record<SignalStatus, number> = {
    FREE: 0,
    SMALL: 0,
    LARGE: 0,
    UNKNOWN: 0,
  };

  for (const answer of fresh) counts[classify(answer.text)] += 1;

  const knownCount = counts.FREE + counts.SMALL + counts.LARGE;
  if (knownCount === 0) {
    return {
      status: 'UNKNOWN',
      label: 'Пока нет понятного сигнала',
      confidence: 0,
      answerCount: answers.length,
      freshAnswerCount: fresh.length,
    };
  }

  const ranked = (['FREE', 'SMALL', 'LARGE'] as const)
    .map(status => ({ status, count: counts[status] }))
    .sort((a, b) => b.count - a.count);

  const winner = ranked[0];
  const runnerUp = ranked[1];
  const confidence = Math.round((winner.count / knownCount) * 100);

  // Do not present a strong signal from a single weak or tied answer.
  const tied = winner.count === runnerUp.count;
  const shouldReport = winner.count >= 2 && !tied;

  const status = shouldReport ? winner.status : 'UNKNOWN';
  const label =
    status === 'FREE'
      ? 'Свободно'
      : status === 'SMALL'
        ? 'Небольшая очередь'
        : status === 'LARGE'
          ? 'Большая очередь'
          : 'Пока недостаточно данных';

  return {
    status,
    label,
    confidence: shouldReport ? confidence : Math.min(confidence, 49),
    answerCount: answers.length,
    freshAnswerCount: fresh.length,
  };
}
