import { createPresenceController, type PresenceSnapshot } from './presence-controller';
import { createSupabasePresenceBackend } from './presence-supabase-adapter';

export type PresenceServiceCallbacks = {
  onChange?: (snapshot: PresenceSnapshot) => void;
  onError?: (error: Error) => void;
};

type ClientLike = Parameters<typeof createSupabasePresenceBackend>[0];

export function createPresenceService(client: ClientLike, callbacks: PresenceServiceCallbacks = {}) {
  const backend = createSupabasePresenceBackend(client);

  const controller = createPresenceController({
    onChange: callbacks.onChange,
    onHeartbeat: async snapshot => {
      if (snapshot.state !== 'ENABLED') return;
      if (snapshot.latitude === null || snapshot.longitude === null || snapshot.accuracyM === null || !snapshot.lastSeenAt) {
        return;
      }

      try {
        await backend.upsertPresence({
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          accuracyM: snapshot.accuracyM,
          lastSeenAt: snapshot.lastSeenAt,
        });
      } catch (error) {
        callbacks.onError?.(error instanceof Error ? error : new Error('Presence heartbeat failed'));
      }
    },
    onStop: async () => {
      try {
        await backend.disablePresence();
      } catch (error) {
        callbacks.onError?.(error instanceof Error ? error : new Error('Presence disable failed'));
      }
    },
  });

  return controller;
}
