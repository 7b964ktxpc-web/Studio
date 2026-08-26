import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  processNotificationBatch,
  type DeliveryResult,
  type NotificationEvent,
  type PushAdapter,
} from '../notification-worker.ts';
import { createSupabaseNotificationQueue } from '../supabase-notification-queue.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || '';
const WORKER_SECRET = Deno.env.get('NOTIFICATION_WORKER_SECRET') || '';

function configError(): string | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return 'Supabase server credentials are not configured';
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return 'VAPID configuration is not configured';
  if (!WORKER_SECRET) return 'Notification worker secret is not configured';
  return null;
}

function messageFor(event: NotificationEvent): string {
  switch (event.kind) {
    case 'NEW_NEARBY_REQUEST': return 'Рядом появился новый вопрос';
    case 'REQUEST_ANSWERED': return 'К вашему вопросу пришёл ответ';
    case 'REQUEST_EXPIRED': return 'Время ожидания вопроса истекло';
  }
}

function createPushAdapter(client: ReturnType<typeof createClient>): PushAdapter {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  return {
    async send(userId: string, event: NotificationEvent): Promise<DeliveryResult> {
      const { data, error } = await client
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth')
        .eq('user_id', userId);

      if (error) throw error;

      const subscriptions = Array.isArray(data) ? data : [];
      if (!subscriptions.length) return { delivered: true };

      const payload = JSON.stringify({
        kind: event.kind,
        requestId: event.requestId,
        title: 'Сейчас',
        body: messageFor(event),
      });

      let delivered = 0;
      let staleRemoved = 0;
      const failures: string[] = [];

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: String(subscription.endpoint),
              keys: {
                p256dh: String(subscription.p256dh),
                auth: String(subscription.auth),
              },
            },
            payload,
          );
          delivered += 1;
        } catch (error) {
          const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : NaN;

          if (statusCode === 404 || statusCode === 410) {
            const endpoint = String(subscription.endpoint || '').trim();
            if (endpoint) {
              const { error: removeError } = await client
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId)
                .eq('endpoint', endpoint);
              if (removeError) {
                failures.push(removeError.message || 'Failed to remove stale push subscription');
              } else {
                staleRemoved += 1;
              }
            }
            continue;
          }

          failures.push(error instanceof Error ? error.message : 'Push delivery failed');
        }
      }

      if (delivered > 0) return { delivered: true };
      if (staleRemoved > 0 && staleRemoved === subscriptions.length && failures.length === 0) return { delivered: true };
      return { delivered: false, error: failures.join('; ').slice(0, 1000) || 'Push delivery failed' };
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const suppliedSecret = req.headers.get('x-notification-worker-secret') || '';
  if (!WORKER_SECRET || suppliedSecret !== WORKER_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const error = configError();
  if (error) return Response.json({ error }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body?.batchSize || 20);
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const queue = createSupabaseNotificationQueue(client);
    const push = createPushAdapter(client);
    const result = await processNotificationBatch(queue, push, batchSize);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notification worker failed';
    console.error('[notification-worker]', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
