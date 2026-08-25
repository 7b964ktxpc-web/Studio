import { aggregateSignal, type SignalAnswer, type SignalSummary } from './signal-aggregation';

export type SignalViewModel = SignalSummary & {
  title: string;
  subtitle: string;
  tone: 'positive' | 'neutral' | 'negative' | 'muted';
};

export function buildSignalViewModel(answers: SignalAnswer[], now = Date.now()): SignalViewModel {
  const summary = aggregateSignal(answers, now);

  const title = summary.label;
  const subtitle = summary.freshAnswerCount
    ? `${summary.freshAnswerCount} подтверждени${summary.freshAnswerCount === 1 ? 'е' : summary.freshAnswerCount < 5 ? 'я' : 'й'} · уверенность ${summary.confidence}%`
    : 'Ждём свежие ответы';

  const tone =
    summary.status === 'FREE'
      ? 'positive'
      : summary.status === 'SMALL'
        ? 'neutral'
        : summary.status === 'LARGE'
          ? 'negative'
          : 'muted';

  return { ...summary, title, subtitle, tone };
}
