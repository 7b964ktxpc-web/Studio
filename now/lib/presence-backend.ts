export type PresenceHeartbeat = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  lastSeenAt: string;
};

export type PresenceBackend = {
  upsertPresence: (heartbeat: PresenceHeartbeat) => Promise<void> | void;
  disablePresence: () => Promise<void> | void;
};

const MAX_ACCURACY_M = 50;
const MAX_HEARTBEAT_AGE_MS = 2 * 60_000;

export function createPresenceCallbacks(backend: PresenceBackend) {
  return {
    onHeartbeat: async (snapshot: {
      state: string;
      latitude: number | null;
      longitude: number | null;
      accuracyM: number | null;
      lastSeenAt: string | null;
    }) => {
      if (snapshot.state !== 'ENABLED') return;
      if (
        snapshot.latitude === null ||
        snapshot.longitude === null ||
        snapshot.accuracyM === null ||
        snapshot.lastSeenAt === null
      ) return;

      const age = Date.now() - Date.parse(snapshot.lastSeenAt);
      if (!Number.isFinite(age) || age < 0 || age > MAX_HEARTBEAT_AGE_MS) return;
      if (snapshot.accuracyM > MAX_ACCURACY_M) return;

      await backend.upsertPresence({
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        accuracyM: snapshot.accuracyM,
        lastSeenAt: snapshot.lastSeenAt,
      });
    },
    onStop: () => backend.disablePresence(),
  };
}
