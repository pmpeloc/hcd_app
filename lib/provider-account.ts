import { address, getAddressEncoder } from '@solana/kit';

const DISCRIMINATOR = [164, 180, 71, 17, 75, 216, 80, 195];

/** Provider layout from the HCD IDL: discriminator, authority, kind,
 * verified, organization, bump. Reject malformed or unrelated accounts. */
export function doctorIsVerified(
  account: { owner: string; data: readonly [string, string] },
  programId: string,
  wallet: string,
): boolean {
  const bytes = Uint8Array.from(atob(account.data[0]), (c) => c.charCodeAt(0));
  const authority = getAddressEncoder().encode(address(wallet));
  if (account.owner !== programId || account.data[1] !== 'base64' || bytes.length < 75
    || !DISCRIMINATOR.every((byte, i) => bytes[i] === byte)
    || !authority.every((byte, i) => bytes[8 + i] === byte)
    || bytes[40] !== 1 || bytes[41] > 1) {
    throw new Error('Invalid doctor Provider account');
  }
  return bytes[41] === 1;
}
