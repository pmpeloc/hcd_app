import { expect, test } from '@playwright/test';
import { doctorIsVerified } from '../lib/provider-account';

const wallet = '11111111111111111111111111111111';
const program = 'synthetic-program';
function account(verified: number, organizationByte: number) {
  const bytes = Buffer.alloc(75);
  bytes.set([164, 180, 71, 17, 75, 216, 80, 195]);
  bytes[40] = 1;
  bytes[41] = verified;
  bytes.fill(organizationByte, 42, 74);
  return { owner: program, data: [bytes.toString('base64'), 'base64'] as const };
}

test('verification is independent of organization bytes', () => {
  expect(doctorIsVerified(account(1, 3), program, wallet)).toBe(true);
  expect(doctorIsVerified(account(0, 1), program, wallet)).toBe(false);
});

test('rejects wrong owner, authority, discriminator, kind, boolean and truncated data', () => {
  expect(() => doctorIsVerified(account(1, 3), 'other-program', wallet)).toThrow();
  for (const [offset, value] of [[0, 0], [8, 1], [40, 0], [41, 2]]) {
    const fixture = account(1, 3);
    const bytes = Buffer.from(fixture.data[0], 'base64');
    bytes[offset] = value;
    expect(() => doctorIsVerified({ ...fixture, data: [bytes.toString('base64'), 'base64'] }, program, wallet)).toThrow();
  }
  expect(() => doctorIsVerified({ owner: program, data: ['', 'base64'] }, program, wallet)).toThrow();
});
