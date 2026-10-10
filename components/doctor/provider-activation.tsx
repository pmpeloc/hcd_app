'use client';

import { useCallback, useEffect, useState } from 'react';
import { address as solanaAddress, createSolanaRpc, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';
import { createApiClient } from '@/lib/api-client';
import { useSaluaWallet } from '@/lib/auth-providers';
import { useSession } from '@/lib/session-provider';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID;
// Smoke/devnet: the clinic Provider's authority wallet, registered on-chain by
// the seed script. Production should resolve this from the API.
const ORG_WALLET = process.env.NEXT_PUBLIC_DOCTOR_ORG;

type Phase = 'checking' | 'missing' | 'pending-verify' | 'ready' | 'error';

async function providerAccount(wallet: string) {
  if (!PROGRAM_ID) return null;
  const [pda] = await getProgramDerivedAddress({
    programAddress: solanaAddress(PROGRAM_ID),
    seeds: [new TextEncoder().encode('provider'), getAddressEncoder().encode(solanaAddress(wallet))],
  });
  const info = await createSolanaRpc(RPC_URL)
    .getAccountInfo(pda, { encoding: 'base64' })
    .send();
  return info.value;
}

/**
 * Doctor's on-chain enrollment: without a verified Provider account the
 * program rejects `issue_record` and `grant_access`. Registers the Provider
 * (user signs; fee payer covers rent) and then waits for the off-chain admin
 * license check to flip `verified`.
 */
export function ProviderActivation() {
  const { session } = useSession();
  const wallet = useSaluaWallet();
  const [phase, setPhase] = useState<Phase>('checking');
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const acc = await providerAccount(wallet.address);
      if (!acc) setPhase('missing');
      else {
        // Provider layout: disc(8) + authority(32) + type(1) + verified(1)
        const verified = atob(acc.data[0]).charCodeAt(49) === 1;
        setPhase(verified ? 'ready' : 'pending-verify');
      }
    } catch {
      setPhase('error');
    }
  }, [wallet.address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wallet.enrolled) void check();
  }, [wallet.enrolled, check]);

  async function register() {
    if (!wallet.address || !ORG_WALLET) return;
    setBusy(true);
    try {
      const { runTx } = await import('@/components/onchain/tx-flow');
      await runTx(
        {
          instruction: 'register_provider',
          signer: wallet.address,
          args: { provider_type: 'doctor', organization: ORG_WALLET },
        },
        { post: createApiClient().post, sign: wallet.signTx },
      );
      setPhase('pending-verify');
    } catch (err) {
      console.error('register_provider failed:', err);
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  if (!session || !wallet.enrolled || phase === 'ready' || phase === 'checking') return null;

  return (
    <Tile tone="sky" className="col-span-2 p-[18px] lg:col-span-12 bento:col-span-12">
      <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">
        {phase === 'pending-verify' ? 'Verificación pendiente' : 'Activá tu cuenta profesional'}
      </h2>
      <p className="mt-1 text-[13px] text-salua-sky-ink">
        {phase === 'pending-verify'
          ? 'Tu cuenta on-chain ya existe. Un administrador está revisando tu matrícula antes de que puedas cargar estudios.'
          : 'Registrá tu cuenta de médico en la cadena para poder cargar estudios y pedir accesos. Firmás una sola vez; no necesitás SOL.'}
      </p>
      {phase !== 'pending-verify' && (
        <Button
          className="mt-3 h-10 px-4 text-sm"
          disabled={busy || !ORG_WALLET}
          onClick={() => void register()}
        >
          {busy ? 'Firmando…' : 'Registrar en la cadena'}
        </Button>
      )}
      {phase === 'error' && (
        <p role="alert" className="mt-2 text-[13px] text-salua-error-ink">
          No pudimos completar el registro. Reintentá.
        </p>
      )}
    </Tile>
  );
}
