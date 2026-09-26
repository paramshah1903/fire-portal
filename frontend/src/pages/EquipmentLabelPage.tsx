import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEquipment, type Equipment } from '../lib/apiEquipment';
import { toApiError } from '../lib/api';
import { QrLabel } from '../components/QrLabel';
import { Button, ErrorBanner } from '../components/ui';

export function EquipmentLabelPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getEquipment(id)
      .then(setEquipment)
      .catch((err) => setError(toApiError(err).message));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <ErrorBanner message={error} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }
  if (!equipment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="print-hide mx-auto mb-4 flex max-w-md items-center justify-between px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600">
            Print label
          </p>
          <p className="text-sm text-slate-700">
            Use your browser's print dialog to print or save as PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.close()}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="flex justify-center">
        <QrLabel equipment={equipment} size="lg" />
      </div>
    </div>
  );
}
