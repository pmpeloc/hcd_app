import { test, expect } from '@playwright/test';
import { createRegistrationStore, registrationDestination } from '../lib/patient-registration';

test('cancelled registration stays failed until explicit retry, then permits redirect', async () => {
  const store = createRegistrationStore();
  let exists = false;
  let attempts = 0;
  const deps = {
    exists: async () => exists,
    register: async () => {
      if (++attempts === 1) throw new Error('User cancelled');
      exists = true;
    },
  };
  await store.start('patient', deps);
  expect(store.snapshot('patient').phase).toBe('error');
  expect(registrationDestination(true, store.snapshot('patient').phase)).toBeNull();
  await store.start('patient', deps);
  expect(attempts).toBe(1);
  await store.start('patient', deps, true);
  expect(attempts).toBe(2);
  expect(registrationDestination(true, store.snapshot('patient').phase)).toBe('/inicio');
});

test('RPC failure never requests a signature and can recover', async () => {
  const store = createRegistrationStore();
  let unavailable = true;
  let signatures = 0;
  const deps = {
    exists: async () => { if (unavailable) throw new Error('RPC unavailable'); return true; },
    register: async () => { signatures++; },
  };
  await store.start('doctor', deps);
  expect(store.snapshot('doctor').phase).toBe('error');
  unavailable = false;
  await store.start('doctor', deps, true);
  expect(signatures).toBe(0);
  expect(registrationDestination(true, store.snapshot('doctor').phase, 'doctor')).toBe('/panel');
});

test('remounts and concurrent retries join one operation without redirecting early', async () => {
  const store = createRegistrationStore();
  let release!: () => void;
  const signed = new Promise<void>((resolve) => { release = resolve; });
  let exists = false;
  let signatures = 0;
  const phases: string[] = [];
  const unsubscribe = store.subscribe(() => phases.push(store.snapshot('patient').phase));
  const deps = {
    exists: async () => exists,
    register: async () => { signatures++; await signed; exists = true; },
  };
  const first = store.start('patient', deps);
  await expect.poll(() => store.snapshot('patient').phase).toBe('registering');
  unsubscribe(); // The old provider unmounts while signing.
  const nextPhases: string[] = [];
  const stop = store.subscribe(() => nextPhases.push(store.snapshot('patient').phase));
  const second = store.start('patient', deps, true);
  expect(second).toBe(first);
  expect(registrationDestination(true, store.snapshot('patient').phase)).toBeNull();
  release();
  await Promise.all([first, second]);
  expect(signatures).toBe(1);
  expect(phases).toEqual(['checking', 'registering']);
  expect(nextPhases).toEqual(['confirmed']);
  await store.start('patient', deps);
  expect(signatures).toBe(1);
  stop();
});

test('a submit timeout that actually landed is recovered without signing twice', async () => {
  const store = createRegistrationStore();
  let exists = false;
  let signatures = 0;
  const deps = {
    exists: async () => exists,
    register: async () => { signatures++; exists = true; throw new Error('Submit response lost'); },
  };
  await store.start('patient', deps);
  expect(store.snapshot('patient').phase).toBe('error');
  await store.start('patient', deps, true);
  expect(store.snapshot('patient').phase).toBe('confirmed');
  expect(signatures).toBe(1);
});

test('submit success alone does not establish a confirmed patient profile', async () => {
  const store = createRegistrationStore();
  await store.start('patient', { exists: async () => false, register: async () => {} });
  expect(store.snapshot('patient').phase).toBe('error');
});

test('another identity cannot inherit registration or redirect before enrollment', async () => {
  const store = createRegistrationStore();
  await store.start('first-user-wallet-network', { exists: async () => true, register: async () => {} });
  expect(store.snapshot('second-user-wallet-network').phase).toBe('idle');
  expect(registrationDestination(false, 'confirmed')).toBeNull();
  for (const phase of ['idle', 'checking', 'registering', 'error'] as const) {
    expect(registrationDestination(true, phase)).toBeNull();
  }
});
