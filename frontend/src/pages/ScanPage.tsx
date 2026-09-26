import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  EQUIPMENT_STATUS_LABELS,
  lookupEquipment,
  type Equipment,
} from '../lib/apiEquipment';
import {
  getCurrentInspectionForEquipment,
  startInspection,
  type CurrentInspectionResult,
} from '../lib/apiInspections';
import { PERMS } from '../lib/permissions';
import { parseScannedValue } from '../lib/qr';
import {
  Badge,
  Button,
  ErrorBanner,
  Input,
  PageHeader,
} from '../components/ui';

type CameraState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'
  | 'denied';

const CAMERA_ELEMENT_ID = 'upl-scan-camera';

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canPerform = hasPermission(PERMS.INSPECTION_PERFORM);
  const initialValue =
    new URLSearchParams(location.search).get('value') ?? '';

  const [manual, setManual] = useState(initialValue);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [currentInsp, setCurrentInsp] =
    useState<CurrentInspectionResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [startingInspection, setStartingInspection] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const lookup = useCallback(
    async (rawInput: string) => {
      const value = parseScannedValue(rawInput);
      if (!value) {
        setScanError('That does not look like a valid QR value.');
        setEquipment(null);
        setCurrentInsp(null);
        return;
      }
      setLookingUp(true);
      setScanError(null);
      setEquipment(null);
      setCurrentInsp(null);
      try {
        const eq = await lookupEquipment(value);
        setEquipment(eq);
        // For inspectors, resolve the current-period inspection state
        // so we can show Start / Continue / View as the primary action.
        if (canPerform) {
          try {
            const state = await getCurrentInspectionForEquipment(eq.id);
            setCurrentInsp(state);
          } catch {
            setCurrentInsp(null);
          }
        }
      } catch (err) {
        const e = toApiError(err);
        setScanError(
          e.status === 404
            ? 'No equipment matches that QR code.'
            : e.status === 403
              ? 'That equipment belongs to a unit you are not assigned to.'
              : e.message,
        );
      } finally {
        setLookingUp(false);
      }
    },
    [canPerform],
  );

  const goInspect = useCallback(async () => {
    if (!equipment || !currentInsp) return;
    // If a completed one exists, view it. If a pending one exists, continue it.
    if (currentInsp.inspection) {
      const insp = currentInsp.inspection;
      if (insp.status === 'COMPLETED') {
        navigate(`/inspections/${insp.id}`);
      } else {
        navigate(`/inspections/${insp.id}/perform`);
      }
      return;
    }
    // No inspection yet — try to start one.
    setStartingInspection(true);
    setScanError(null);
    try {
      const insp = await startInspection(equipment.id);
      navigate(`/inspections/${insp.id}/perform`);
    } catch (err) {
      setScanError(toApiError(err).message);
    } finally {
      setStartingInspection(false);
    }
  }, [equipment, currentInsp, navigate]);

  // If the page was opened with ?value=… (e.g. from /s/:value), look it up.
  useEffect(() => {
    if (initialValue) {
      void lookup(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    // Detach immediately so a re-entrant call can't double-stop.
    scannerRef.current = null;
    setCameraState('stopping');
    try {
      if (s.isScanning) await s.stop();
    } catch {
      // stop() throws if the stream was already torn down; safe to ignore.
    }
    try {
      s.clear();
    } catch {
      // clear() can throw if the DOM node is already gone (e.g. on
      // unmount) — safe to ignore.
    }
    setCameraState('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraState('starting');
    try {
      const s = new Html5Qrcode(CAMERA_ELEMENT_ID, { verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const min = Math.min(w, h);
            const size = Math.max(160, Math.min(320, Math.floor(min * 0.7)));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // First hit wins — pause, look up, then keep the camera off.
          await stopCamera();
          await lookup(decodedText);
        },
        () => {
          /* per-frame scan failures are common; ignore */
        },
      );
      setCameraState('running');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/permission|denied|NotAllowed/i.test(message)) {
        setCameraState('denied');
        setCameraError(
          'Camera permission was denied. Enable it for this page, or paste the QR value below.',
        );
      } else {
        setCameraState('error');
        setCameraError(
          `Unable to start the camera: ${message}. You can still paste the QR value below.`,
        );
      }
      scannerRef.current = null;
    }
  }, [lookup, stopCamera]);

  // Clean up the camera if the user navigates away.
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    void lookup(manual);
  }

  return (
    <div>
      <PageHeader
        title="Scan equipment"
        description="Use your device camera to scan an equipment QR label, or paste the QR value manually."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Camera
          </h2>

          {/*
            The camera preview is split into two nested elements:
              - the outer wrapper is owned by React (className, overlay)
              - the inner div is owned by html5-qrcode (video/canvas)
            React never touches the inner div's children or className
            after mount, which prevents a "removeChild" reconcile crash
            when the library injects its own DOM nodes.
          */}
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-slate-900">
            <div id={CAMERA_ELEMENT_ID} className="absolute inset-0" />
            {cameraState !== 'running' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/70">
                <p className="px-4 text-center text-xs text-slate-300">
                  {cameraState === 'idle' && 'Camera is off.'}
                  {cameraState === 'starting' && 'Starting camera…'}
                  {cameraState === 'stopping' && 'Stopping camera…'}
                  {(cameraState === 'error' || cameraState === 'denied') &&
                    'Camera unavailable.'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {cameraState !== 'running' ? (
              <Button
                onClick={startCamera}
                disabled={cameraState === 'starting'}
              >
                {cameraState === 'starting' ? 'Starting…' : 'Start camera'}
              </Button>
            ) : (
              <Button variant="secondary" onClick={stopCamera}>
                Stop camera
              </Button>
            )}
          </div>

          {cameraError && (
            <div className="mt-3">
              <ErrorBanner message={cameraError} />
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Point the camera at the QR label on the equipment. Scanning does
            not authenticate you — you must be signed in with the right role
            to submit an inspection.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Manual entry
          </h2>
          <form onSubmit={onManualSubmit} className="space-y-3">
            <Input
              label="QR value or URL"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="EQ-A1B2C3D4E5F6"
              hint="Type or paste the code printed under the QR image."
            />
            <Button type="submit" disabled={!manual.trim() || lookingUp}>
              {lookingUp ? 'Looking up…' : 'Lookup'}
            </Button>
          </form>

          {scanError && (
            <div className="mt-4">
              <ErrorBanner message={scanError} />
            </div>
          )}

          {equipment && !scanError && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
                Equipment found
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {equipment.name}
              </p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                {equipment.equipmentCode} · {equipment.qrCodeValue}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="blue">{equipment.equipmentType.name}</Badge>
                <Badge tone="slate">{equipment.unit.code}</Badge>
                <Badge
                  tone={
                    equipment.status === 'ACTIVE'
                      ? 'green'
                      : equipment.status === 'UNDER_MAINTENANCE'
                        ? 'amber'
                        : equipment.status === 'OUT_OF_SERVICE'
                          ? 'red'
                          : 'slate'
                  }
                >
                  {EQUIPMENT_STATUS_LABELS[equipment.status]}
                </Badge>
                {!equipment.isActive && <Badge tone="slate">Inactive</Badge>}
              </div>

              {(!equipment.isActive || equipment.status === 'RETIRED') && (
                <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  This equipment is not part of the current inspection
                  schedule. You can still open the record, but no monthly
                  inspection is expected.
                </p>
              )}

              {equipment.status === 'OUT_OF_SERVICE' && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
                  This equipment is currently out of service. Contact your
                  supervisor before performing any work on it.
                </p>
              )}

              {/*
                Primary action depends on role + inspection state:
                  - Inspector with a completed inspection this month → View
                  - Inspector with a pending inspection → Continue
                  - Inspector on eligible equipment with no inspection → Start
                  - Anyone else → Open equipment
              */}
              <div className="mt-4 flex flex-wrap gap-2">
                {canPerform && currentInsp?.eligibleToStart ? (
                  <>
                    <Button
                      onClick={goInspect}
                      disabled={startingInspection}
                    >
                      {startingInspection
                        ? 'Starting…'
                        : currentInsp.inspection?.status === 'COMPLETED'
                          ? "View this month's inspection"
                          : currentInsp.inspection?.status === 'PENDING'
                            ? 'Continue inspection'
                            : 'Start inspection'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(`/equipment/${equipment.id}`)
                      }
                    >
                      Open equipment
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => navigate(`/equipment/${equipment.id}`)}>
                    Open equipment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEquipment(null);
                    setCurrentInsp(null);
                    setManual('');
                    setScanError(null);
                    void startCamera();
                  }}
                >
                  Scan another
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
