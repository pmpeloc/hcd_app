import { apiFetch } from '@/lib/api';

/**
 * Wallet enrollment: proves possession of the Privy embedded wallet by signing
 * a backend-issued challenge. Creating the wallet is NOT enrollment — the API
 * only binds it after `/auth/wallet/verify` accepts the Ed25519 signature.
 * Contract: `hcd_api` `src/auth/WALLET_ENROLLMENT.md` (PR #22).
 */

export type Profile = {
  id: string;
  role: string;
  status: string;
  organization_id: string | null;
  wallet_pubkey: string | null;
  wallet_verified_at: string | null;
};

type Challenge = { challenge_id: string; message: string; expires_at: string };

/** Signs the exact challenge bytes with the user's wallet; returns raw signature bytes. */
export type MessageSigner = (message: Uint8Array) => Promise<Uint8Array>;

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

/**
 * Ensures the profile exists, then — when the bound wallet is missing or
 * different verification is pending — runs challenge → user signature →
 * verify. The user sees and approves Privy's signing modal; nothing here
 * ever sends a transaction or skips that interaction.
 */
export async function enrollWallet(
  token: string,
  walletPubkey: string,
  sign: MessageSigner,
): Promise<Profile> {
  // Idempotent: creates the app_user row as patient on first login, never
  // overwrites an existing role, organization or wallet.
  await apiFetch('/auth/profile', token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const profile = await apiFetch<Profile>('/auth/profile', token);
  if (profile.wallet_pubkey === walletPubkey && profile.wallet_verified_at) {
    return profile;
  }
  const challenge = await apiFetch<Challenge>('/auth/wallet/challenge', token, {
    method: 'POST',
    body: JSON.stringify({ wallet_pubkey: walletPubkey }),
  });
  const signature = await sign(new TextEncoder().encode(challenge.message));
  return apiFetch<Profile>('/auth/wallet/verify', token, {
    method: 'POST',
    body: JSON.stringify({
      challenge_id: challenge.challenge_id,
      signature: toBase64(signature),
    }),
  });
}
