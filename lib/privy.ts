import type { User } from '@privy-io/react-auth';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

// Match the Supabase subject before displaying or creating any wallet.
export function matchesSession(user: User | null, subject: string) {
  return !!user?.linkedAccounts.some(account =>
    account.type === 'custom_auth' && account.customUserId === subject);
}

export function embeddedSolanaAddress(user: User | null) {
  const account = user?.linkedAccounts.find(account => account.type === 'wallet'
    && account.chainType === 'solana'
    && (account.walletClientType === 'privy' || account.walletClientType === 'privy-v2'));
  return account?.type === 'wallet' ? account.address : undefined;
}
