export type RegistrationPhase = 'idle' | 'checking' | 'registering' | 'confirmed' | 'error';
export type RegistrationState = Readonly<{ phase: RegistrationPhase }>;
type Dependencies = { exists: () => Promise<boolean>; register: () => Promise<void> };
const IDLE: RegistrationState = { phase: 'idle' };

/** Shared across provider remounts in this browser. Never stores tokens or keys. */
export function createRegistrationStore() {
  const states = new Map<string, RegistrationState>();
  const pending = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  function set(key: string, phase: RegistrationPhase) {
    states.set(key, { phase });
    listeners.forEach((notify) => notify());
  }
  return {
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => { listeners.delete(notify); };
    },
    snapshot(key: string) { return states.get(key) ?? IDLE; },
    serverSnapshot() { return IDLE; },
    start(key: string, deps: Dependencies, retry = false): Promise<void> {
      const existing = pending.get(key);
      if (existing) return existing;
      const phase = states.get(key)?.phase;
      if (phase === 'confirmed' || (phase === 'error' && !retry)) return Promise.resolve();
      // Defer work until the lock exists, including synchronous subscribers.
      const operation = Promise.resolve().then(async () => {
        set(key, 'checking');
        try {
          if (!(await deps.exists())) {
            set(key, 'registering');
            await deps.register();
            if (!(await deps.exists())) throw new Error('Patient profile not confirmed');
          }
          set(key, 'confirmed');
        } catch {
          // A submit can time out after confirmation. A retry always checks
          // the PDA first, avoiding a second signature in that case.
          set(key, 'error');
        }
      }).finally(() => { pending.delete(key); });
      pending.set(key, operation);
      return operation;
    },
  };
}

export const patientRegistration = createRegistrationStore();

export function registrationDestination(enrolled: boolean, phase: RegistrationPhase, role?: string) {
  return enrolled && phase === 'confirmed' ? (role === 'doctor' ? '/panel' : '/inicio') : null;
}
