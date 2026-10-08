'use client';

import { useEffect, useRef, useState } from 'react';
import type { DocKind } from './open-record';

type DocumentCanvasProps = {
  bytes: ArrayBuffer;
  kind: DocKind;
  title: string;
  /** Burned into every page: reader's name, license and the date and time it was opened. */
  watermark: string;
};

type RenderState = { phase: 'rendering' } | { phase: 'done'; pages: number } | { phase: 'unsupported' } | { phase: 'failed' };

/** Tiles the watermark diagonally over the whole canvas, inside the pixels themselves. */
function drawWatermark(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = Math.max(12, Math.round(canvas.width / 46));
  ctx.save();
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(13, 41, 80, 0.09)';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-24 * Math.PI) / 180);
  const step = { x: ctx.measureText(text).width + size * 4, y: size * 4.5 };
  const reach = Math.hypot(canvas.width, canvas.height);
  for (let y = -reach; y < reach; y += step.y) {
    const shift = (Math.round(y / step.y) % 2) * (step.x / 2);
    for (let x = -reach - shift; x < reach; x += step.x) ctx.fillText(text, x, y);
  }
  ctx.restore();
}

async function renderPdf(bytes: ArrayBuffer, host: HTMLElement, width: number, title: string, watermark: string, cancelled: () => boolean) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  // pdf.js transfers the buffer to its worker; keep the caller's copy intact.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) });
  const doc = await task.promise;
  try {
    const dpr = window.devicePixelRatio || 1;
    for (let n = 1; n <= doc.numPages && !cancelled(); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width * dpr) / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.className = 'block h-auto w-full rounded-lg bg-white shadow-[0_1px_3px_rgba(13,41,80,0.12)]';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${title}, página ${n} de ${doc.numPages}`);
      await page.render({ canvas, viewport }).promise;
      drawWatermark(canvas, watermark);
      if (!cancelled()) host.append(canvas);
    }
    return doc.numPages;
  } finally {
    void task.destroy();
  }
}

async function renderImage(bytes: ArrayBuffer, kind: 'png' | 'jpeg', host: HTMLElement, title: string, watermark: string) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: `image/${kind}` }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.className = 'block h-auto w-full rounded-lg bg-white';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', title);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  drawWatermark(canvas, watermark);
  host.append(canvas);
  return 1;
}

/**
 * Draws the decrypted study on canvases with the watermark in the pixels. No file URL, link or
 * download control ever exists; the decrypted bytes live only in memory while the page is open.
 */
export function DocumentCanvas({ bytes, kind, title, watermark }: DocumentCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>(() =>
    kind === 'pdf' || kind === 'png' || kind === 'jpeg' ? { phase: 'rendering' } : { phase: 'unsupported' },
  );

  useEffect(() => {
    const el = host.current;
    if (!el || !(kind === 'pdf' || kind === 'png' || kind === 'jpeg')) return;
    let cancelled = false;
    el.replaceChildren();
    const width = Math.min(el.clientWidth || 800, 1100);
    const job =
      kind === 'pdf'
        ? renderPdf(bytes, el, width, title, watermark, () => cancelled)
        : renderImage(bytes, kind, el, title, watermark);
    job.then(
      (pages) => !cancelled && setState({ phase: 'done', pages }),
      () => !cancelled && setState({ phase: 'failed' }),
    );
    return () => {
      cancelled = true;
      el.replaceChildren();
    };
  }, [bytes, kind, title, watermark]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="relative select-none print:hidden"
      aria-busy={state.phase === 'rendering'}
    >
      <div ref={host} className="flex flex-col gap-3" />
      {state.phase === 'rendering' && <div className="aspect-[1/1.414] w-full rounded-lg bg-white/70 motion-safe:animate-pulse" />}
      {state.phase === 'unsupported' && (
        <p className="rounded-lg bg-white px-5 py-10 text-center text-sm text-muted-foreground">
          Este formato (por ejemplo, DICOM) todavía no se puede mostrar en el visor. La integridad del archivo ya se verificó.
        </p>
      )}
      {state.phase === 'failed' && (
        <p role="alert" className="rounded-lg bg-white px-5 py-10 text-center text-sm text-salua-error-ink">
          No pudimos dibujar el documento. Recargá la página para intentarlo de nuevo.
        </p>
      )}
    </div>
  );
}
