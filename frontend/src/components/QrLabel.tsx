import { QRCodeSVG } from 'qrcode.react';
import { qrPayload } from '../lib/qr';

export interface QrLabelEquipment {
  equipmentCode: string;
  qrCodeValue: string;
  name: string;
  unit?: { code: string; name: string } | null;
  department?: { code: string; name: string } | null;
  building?: string | null;
  floor?: string | null;
  location?: string | null;
  area?: string | null;
}

/**
 * A printable equipment label. Sized in mm so it prints at a known
 * physical size regardless of screen density. Border stays on print
 * so the sheet can be cut cleanly.
 *
 * The label follows the layout described in the spec:
 *   UPL
 *   FIRE SAFETY EQUIPMENT
 *   <equipment name>
 *   <equipment ID>
 *   <location>
 *   <QR code>
 */
export function QrLabel({
  equipment,
  size = 'md',
}: {
  equipment: QrLabelEquipment;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims =
    size === 'sm'
      ? { width: '55mm', qr: 110 }
      : size === 'lg'
        ? { width: '90mm', qr: 180 }
        : { width: '70mm', qr: 140 };

  const locationParts = [
    equipment.unit?.code,
    equipment.building,
    equipment.floor,
    equipment.location,
  ]
    .filter((x) => !!x && String(x).trim().length > 0)
    .join(' · ');

  return (
    <div
      className="qr-label inline-block break-inside-avoid rounded border border-slate-800 bg-white p-2 text-slate-900"
      style={{ width: dims.width }}
    >
      <div className="text-center leading-tight">
        <p className="text-[10px] font-bold tracking-[0.3em]">UPL</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-700">
          Fire Safety Equipment
        </p>
      </div>

      <div className="mt-1 border-t border-slate-300 pt-1 text-center">
        <p className="text-[11px] font-semibold leading-tight" title={equipment.name}>
          {truncate(equipment.name, 60)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-700">
          {equipment.equipmentCode}
        </p>
      </div>

      <div className="mt-2 flex justify-center">
        <QRCodeSVG
          value={qrPayload(equipment.qrCodeValue)}
          size={dims.qr}
          level="M"
          marginSize={0}
        />
      </div>

      <p className="mt-1 text-center font-mono text-[8px] text-slate-500">
        {equipment.qrCodeValue}
      </p>

      {locationParts && (
        <p className="mt-1 truncate border-t border-slate-200 pt-1 text-center text-[8px] text-slate-600">
          {locationParts}
        </p>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
