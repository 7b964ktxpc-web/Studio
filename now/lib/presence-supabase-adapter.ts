export type PresenceBackendRow = {
  user_id: string;
  location: string;
  accuracy_m: number;
  available: boolean;
  last_seen_at: string;
};

type SupabaseLike = {
  auth?: { getUser?: () => Promise<{ data?: { user?: { id?: string } } }> };
  from: (table: string) => {
    upsert: (row: PresenceBackendRow, options?: { onConflict?: string }) => PromiseLike<unknown>;
    update: (values: Partial<PresenceBackendRow>) => {
      eq: (column: string, value: string) => PromiseLike<unknown>;
    };
  };
};

const MAX_ACCURACY_M = 50;

function pointWkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

export function createSupabasePresenceBackend(client: SupabaseLike) {
  const getUserId = async (): Promise<string> => {
    const result = await client.auth?.getUser?.();
    const id = result?.data?.user?.id;
    if (!id) throw new Error('Authentication required');
    return id;
  };

  return {
    async upsertPresence(input: {
      latitude: number;
      longitude: number;
      accuracyM: number;
      lastSeenAt: string;
    }): Promise<void> {
      if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
        throw new Error('Invalid location');
      }
      if (!Number.isFinite(input.accuracyM) || input.accuracyM < 0 || input.accuracyM > MAX_ACCURACY_M) {
        throw new Error('Location accuracy is insufficient');
      }

      const userId = await getUserId();
      const age = Date.now() - Date.parse(input.lastSeenAt);
      if (!Number.isFinite(age) || age < 0 || age > 2 * 60_000) {
        throw new Error('Stale presence heartbeat');
      }

      const row: PresenceBackendRow = {
        user_id: userId,
        location: pointWkt(input.latitude, input.longitude),
        accuracy_m: input.accuracyM,
        available: true,
        last_seen_at: input.lastSeenAt,
      };

      await client.from('presence').upsert(row, { onConflict: 'user_id' });
    },

    async disablePresence(): Promise<void> {
      const userId = await getUserId();
      await client.from('presence').update({ available: false }).eq('user_id', userId);
    },
  };
}
