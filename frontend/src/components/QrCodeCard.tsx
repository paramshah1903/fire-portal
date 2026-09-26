import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from './ui';
import { qrPayload } from '../lib/qr';
import type { Equipment } from '../lib/apiEquipment';

interface Props {
  equipment: Equipment;
}

export function QrCodeCard({ equipment }: Props) {
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const payload = qrPayload(equipment.qrCodeValue);

  function downloadPng() {
    const canvas = canvasWrapperRef.current?.querySelector<HTMLCanvasElement>(
      'canvas',
    );
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${equipment.equipmentCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">QR Code</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadPng}>
            Download PNG
          </Button>
          <Link
            to={`/equipment/${equipment.id}/label`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Open print label
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div
          ref={canvasWrapperRef}
          className="flex items-center justify-center rounded-md border border-slate-200 bg-white p-4"
        >
          <QRCodeCanvas
            value={payload}
            size={220}
            level="M"
            marginSize={2}
            includeMargin={false}
          />
        </div>

        <div className="text-sm text-slate-700">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Encoded value
          </p>
          <p className="mt-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
            {payload}
          </p>

          <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">
            QR identifier
          </p>
          <p className="mt-1 font-mono text-sm">{equipment.qrCodeValue}</p>

          <p className="mt-4 text-xs text-slate-500">
            Scanning a QR does <strong>not</strong> authenticate anyone — an
            inspector must be signed in with the right role before an
            inspection can be submitted.
          </p>
        </div>
      </div>
    </section>
  );
}
