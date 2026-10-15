import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Salua · Tu historia clínica, bajo tu control';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  // next/og can't decode WebP, so reuse the PNG icon generated from the logo.
  const logo = await readFile(join(process.cwd(), 'app/icon.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 64,
          padding: '0 96px',
          background: 'linear-gradient(135deg, #0d2950 0%, #0a4f8f 100%)',
          color: '#ffffff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img */}
        <img src={logoSrc} width={280} height={280} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -2 }}>Salua</div>
          <div style={{ fontSize: 44, color: '#e6f3fd' }}>Tu historia clínica, bajo tu control.</div>
          <div style={{ fontSize: 28, color: '#9ccbf2', maxWidth: 640 }}>
            Vos decidís quién la lee y por cuánto tiempo. Cada acceso queda registrado en Solana.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
