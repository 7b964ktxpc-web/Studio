export type PresenceUiState = 'OFF' | 'STARTING' | 'ENABLED' | 'LOW_ACCURACY' | 'PAUSED';

export type PresenceSnapshot = {
  state: PresenceUiState;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  lastSeenAt: string | null;
};

export type PresenceCallbacks = {
  onChange?: (snapshot: PresenceSnapshot) => void;
  onHeartbeat?: (snapshot: PresenceSnapshot) => Promise<void> | void;
  onStop?: () => Promise<void> | void;
};

const MAX_ACCURACY_M = 50;
const HEARTBEAT_MS = 60_000;
const MAX_STALE_MS = 5 * 60_000;

function emptySnapshot(): PresenceSnapshot {
  return {
    state: 'OFF',
    latitude: null,
    longitude: null,
    accuracyM: null,
    lastSeenAt: null,
  };
}

function validCoordinates(latitude: number, longitude: number, accuracy: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && Number.isFinite(accuracy)
    && accuracy >= 0;
}

export function createPresenceController(callbacks: PresenceCallbacks = {}) {
  let snapshot = emptySnapshot();
  let watchId: number | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const emit = () => callbacks.onChange?.({ ...snapshot });

  const stopTimers = () => {
    if (watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (heartbeatId !== null) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
  };

  const setSnapshot = (next: PresenceSnapshot) => {
    snapshot = next;
    emit();
  };

  const heartbeat = async () => {
    if (snapshot.state !== 'ENABLED') return;
    if (!snapshot.lastSeenAt || Date.now() - Date.parse(snapshot.lastSeenAt) > MAX_STALE_MS) {
      stopTimers();
      setSnapshot({ ...emptySnapshot(), state: 'PAUSED' });
      return;
    }
    await callbacks.onHeartbeat?.({ ...snapshot });
  };

  const start = async () => {
    stopTimers();
    if (!navigator.geolocation) throw new Error('Geolocation is not supported');

    setSnapshot({ ...emptySnapshot(), state: 'STARTING' });

    await new Promise<void>((resolve, reject) => {
      watchId = navigator.geolocation.watchPosition(
        position => {
          const { latitude, longitude, accuracy } = position.coords;
          if (!validCoordinates(latitude, longitude, accuracy)) {
            setSnapshot({ ...emptySnapshot(), state: 'LOW_ACCURACY' });
            return;
          }

          const now = new Date().toISOString();
          const nextState: PresenceUiState = accuracy <= MAX_ACCURACY_M ? 'ENABLED' : 'LOW_ACCURACY';
          setSnapshot({
            state: nextState,
            latitude: nextState === 'ENABLED' ? latitude : null,
            longitude: nextState === 'ENABLED' ? longitude : null,
            accuracyM: accuracy,
            lastSeenAt: now,
          });

          if (nextState === 'ENABLED') {
            void callbacks.onHeartbeat?.({ ...snapshot });
          }
          resolve();
        },
        error => {
          stopTimers();
          setSnapshot({ ...emptySnapshot(), state: 'PAUSED' });
          reject(new Error(error.message || 'Unable to read location'));
        },
        { enableHighAccuracy: true, maximumAge: 20_000, timeout: 15_000 },
      );
    });

    heartbeatId = setInterval(() => { void heartbeat(); }, HEARTBEAT_MS);
  };

  const pause = async () => {
    stopTimers();
    setSnapshot({ ...emptySnapshot(), state: 'PAUSED' });
    await callbacks.onStop?.();
  };

  const stop = async () => {
    stopTimers();
    setSnapshot(emptySnapshot());
    await callbacks.onStop?.();
  };

  const getSnapshot = () => ({ ...snapshot });

  return { start, pause, stop, getSnapshot };
}
