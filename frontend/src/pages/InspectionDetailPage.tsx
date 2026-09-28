import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toApiError } from '../lib/api';
import {
  approveInspection,
  getInspection,
  inspectionAttachmentUrl,
  rejectInspection,
  type InspectionDetail,
  type InspectionEquipmentContext,
  type InspectionResponseRow,
} from '../lib/apiInspections';
import { QUESTION_TYPE_LABELS } from '../lib/apiChecklists';
import {
  listCorrectiveActions,
  type CorrectiveActionListItem,
} from '../lib/apiCorrectiveActions';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../lib/permissions';
import {
  Badge,
  Button,
  ErrorBanner,
  PageHeader,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';
import { PriorityBadge, StatusBadge } from './CorrectiveActionsPage';

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [insp, setInsp] = useState<InspectionDetail | null>(null);
  const [cas, setCas] = useState<CorrectiveActionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const item = await getInspection(id);
      setInsp(item);
      // Fetch corrective actions raised from this inspection (if any).
      try {
        const res = await listCorrectiveActions({
          sourceInspectionId: id,
          pageSize: 100,
        });
        setCas(res.rows);
      } catch {
        setCas([]);
      }
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, [id]);

  async function onApprove() {
    if (!insp) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await approveInspection(insp.id);
      setInsp(updated);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!insp || !rejectReason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await rejectInspection(insp.id, rejectReason.trim());
      setInsp(updated);
      setShowReject(false);
      setRejectReason('');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !insp) {
    return (
      <div>
        <PageHeader title="Inspection" />
        <ErrorBanner message={error} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/inspections')}>
            Back
          </Button>
        </div>
      </div>
    );
  }
  if (!insp) {
    return (
      <div>
        <PageHeader title="Inspection" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  const responseByQ = new Map(insp.responses.map((r) => [r.questionId, r]));
  const caByResponseId = new Map(
    cas.filter((c) => c.sourceResponseId).map((c) => [c.sourceResponseId!, c]),
  );

  const template = insp.templateVersion.template;
  const signatureLine = template.signatureLine?.trim() || "Inspector's signature";
  const isPendingApproval = insp.status === 'PENDING_APPROVAL';
  const isSuperAdmin = user?.roleKey === ROLES.SUPER_ADMIN;
  const isListedApprover = template.approvers.some(
    (a) => a.userId === user?.id,
  );
  const canReviewThis =
    isPendingApproval &&
    user?.id !== insp.inspectorId &&
    (isSuperAdmin || isListedApprover);

  return (
    <div className="mx-auto max-w-3xl print-color">
      {/* Print-only header — replaces the app PageHeader on paper so the
          PDF opens with clean, form-like branding rather than nav chrome. */}
      <div className="mb-4 hidden border-b-2 border-slate-800 pb-3 print:block">
        {template.headerText && (
          <p className="whitespace-pre-wrap text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
            {template.headerText}
          </p>
        )}
        <p className="mt-2 text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
          {template.name}
        </p>
        {insp.inspectionNumber && (
          <p className="mt-1 text-center text-xs text-slate-700 dark:text-slate-300">
            Inspection No.{' '}
            <span className="font-mono font-semibold">
              {insp.inspectionNumber}
            </span>
          </p>
        )}
      </div>

      <div className="print:hidden">
        <PageHeader
          title={`Inspection — ${insp.equipment.name}`}
          description={
            <>
              {insp.inspectionNumber && (
                <>
                  <span className="font-mono font-semibold text-brand-700">
                    {insp.inspectionNumber}
                  </span>{' '}
                  ·{' '}
                </>
              )}
              <span className="font-mono">{insp.equipment.equipmentCode}</span>{' '}
              · {insp.templateVersion.template.name} (v{insp.templateVersion.versionNumber}){' '}
              · Period <span className="font-mono">{insp.periodKey}</span>
            </>
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate('/inspections')}>
                Back
              </Button>
              <Link
                to={`/equipment/${insp.equipment.id}`}
                className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Open equipment
              </Link>
              {insp.status === 'COMPLETED' && (
                <Button onClick={() => window.print()}>
                  Print / Save as PDF
                </Button>
              )}
              {canReviewThis && (
                <>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => setShowReject(true)}
                  >
                    Reject
                  </Button>
                  <Button disabled={busy} onClick={onApprove}>
                    {busy ? 'Approving…' : 'Approve'}
                  </Button>
                </>
              )}
            </>
          }
        />
      </div>

      {/* Approval status banners */}
      {isPendingApproval && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Awaiting approval.</strong>{' '}
          This inspection has been submitted and is waiting for a reviewer
          before it becomes a valid record. Reviewers assigned on this
          template:{' '}
          {template.approvers.length === 0 ? (
            <em>none</em>
          ) : (
            template.approvers.map((a, i) => (
              <span key={a.userId}>
                {i > 0 && ', '}
                {a.user.fullName}
              </span>
            ))
          )}
          .
        </div>
      )}
      {insp.status === 'PENDING' && insp.rejectionReason && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
          <strong>Rejected by reviewer.</strong>{' '}
          {insp.rejectedBy && (
            <>({insp.rejectedBy.fullName}
            {insp.rejectedAt
              ? ` on ${new Date(insp.rejectedAt).toLocaleString()}`
              : ''}
            ) </>
          )}
          <br />
          Reason: {insp.rejectionReason}
        </div>
      )}
      {error && !isPendingApproval && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SummaryCard
          label="Overall result"
          value={
            insp.status === 'PENDING' ? (
              <Badge tone="amber">In progress</Badge>
            ) : insp.result === 'PASS' ? (
              <Badge tone="green">PASS</Badge>
            ) : insp.hasSafetyCriticalFailure ? (
              <Badge tone="red">FAIL · safety-critical</Badge>
            ) : (
              <Badge tone="amber">FAIL</Badge>
            )
          }
        />
        <SummaryCard
          label="Inspector"
          value={insp.inspector.fullName}
          extra={insp.inspector.username}
        />
        <SummaryCard
          label="Completed"
          value={
            insp.completedAt
              ? new Date(insp.completedAt).toLocaleString()
              : '—'
          }
          extra={insp.confirmationName ? `Confirmed by ${insp.confirmationName}` : undefined}
        />
      </section>

      {/* Equipment context — serial, asset, location kept on the
          completed record for auditors and the future PDF export. */}
      <EquipmentDetailStrip
        equipment={insp.equipment}
        unit={insp.unit}
      />

      {insp.remarks && (
        <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Inspector remarks
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {insp.remarks}
          </p>
        </section>
      )}

      <div className="space-y-4">
        {insp.templateVersion.sections.map((section, si) => (
          <section
            key={section.id}
            className="print-avoid-break rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <header className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Section {si + 1}
              </p>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {section.title}
              </h2>
            </header>
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {section.questions.map((q, qi) => (
                <li
                  key={q.id}
                  className={`px-4 py-3 text-sm ${
                    responseByQ.get(q.id)?.isFail && q.isSafetyCritical
                      ? 'bg-red-50/60'
                      : responseByQ.get(q.id)?.isFail
                        ? 'bg-amber-50/60'
                        : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 dark:text-slate-200">
                        <span className="mr-2 text-xs text-slate-400">
                          {si + 1}.{qi + 1}
                        </span>
                        {q.text}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="blue">
                          {QUESTION_TYPE_LABELS[q.questionType]}
                        </Badge>
                        {q.isMandatory && <Badge tone="slate">Mandatory</Badge>}
                        {q.isSafetyCritical && (
                          <Badge tone="red">Safety-critical</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <AnswerDisplay row={responseByQ.get(q.id)} />
                    </div>
                  </div>
                  {(responseByQ.get(q.id)?.attachments ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {responseByQ.get(q.id)?.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={inspectionAttachmentUrl(a.id)}
                          target="_blank"
                          rel="noopener"
                          className="block h-24 w-24 overflow-hidden rounded border border-slate-300 dark:border-slate-600"
                          title={a.originalName}
                        >
                          <img
                            src={inspectionAttachmentUrl(a.id)}
                            alt={a.caption ?? a.originalName}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const r = responseByQ.get(q.id);
                    if (!r) return null;
                    const ca = caByResponseId.get(r.id);
                    if (!ca) return null;
                    return (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                        <p className="mb-1 font-semibold text-amber-900">
                          Auto-created corrective action:
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/corrective-actions/${ca.id}`}
                            className="font-mono text-brand-700 hover:underline"
                          >
                            {ca.code}
                          </Link>
                          <PriorityBadge priority={ca.priority} />
                          <StatusBadge status={ca.status} />
                          {ca.assignee && (
                            <span className="text-slate-600 dark:text-slate-400">
                              → {ca.assignee.fullName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Signature block — visible on screen and print, useful as a
          formal sign-off area on the PDF. */}
      {insp.status === 'COMPLETED' && (
        <section className="print-avoid-break mt-6 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {signatureLine}
            </p>
            <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
              {insp.confirmationName ?? insp.inspector.fullName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {insp.inspector.fullName} · {insp.inspector.username}
            </p>
            <div className="mt-6 border-t border-slate-400" />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Signature
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Reviewed by
            </p>
            <p className="mt-2 text-sm text-slate-400">—</p>
            <div className="mt-6 border-t border-slate-400" />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Name &amp; signature
            </p>
          </div>
        </section>
      )}

      {/* Optional template footer text, printed at the bottom of the PDF. */}
      {template.footerText && (
        <p className="mt-4 whitespace-pre-wrap border-t border-slate-200 dark:border-slate-700 pt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {template.footerText}
        </p>
      )}

      <Modal
        open={showReject}
        onClose={() => setShowReject(false)}
        title="Reject inspection?"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onReject}
              disabled={busy || !rejectReason.trim()}
            >
              {busy ? 'Rejecting…' : 'Reject and return to inspector'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          The inspection will return to the inspector with your reason.
          They can edit and re-submit.
        </p>
        <div className="mt-3">
          <TextArea
            label="Rejection reason"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Photo of pressure gauge is unclear — please retake."
          />
        </div>
      </Modal>
    </div>
  );
}

function EquipmentDetailStrip({
  equipment,
  unit,
}: {
  equipment: InspectionEquipmentContext;
  unit: { id: string; code: string; name: string };
}) {
  const locationParts = [
    equipment.building,
    equipment.floor,
    equipment.area,
    equipment.location,
  ]
    .filter((p) => !!p && String(p).trim().length > 0)
    .join(' · ');

  const fields: Array<[string, React.ReactNode]> = [
    ['Equipment code', <span className="font-mono">{equipment.equipmentCode}</span>],
    ['Type', equipment.equipmentType.name],
    ['Unit', `${unit.code} — ${unit.name}`],
    [
      'Department',
      equipment.department
        ? `${equipment.department.code} — ${equipment.department.name}`
        : '—',
    ],
    ['Serial number', equipment.serialNumber ?? '—'],
    ['Asset number', equipment.assetNumber ?? '—'],
    ['Location', locationParts || '—'],
    ['Exact location', equipment.exactLocation ?? '—'],
    ['Manufacturer', equipment.manufacturer ?? '—'],
    ['Model', equipment.model ?? '—'],
    ['Capacity', equipment.capacity ?? '—'],
    [
      'Installation date',
      equipment.installationDate
        ? new Date(equipment.installationDate).toLocaleDateString()
        : '—',
    ],
  ];

  return (
    <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Equipment details
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </dt>
            <dd className="text-slate-800 dark:text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  extra,
}: {
  label: string;
  value: React.ReactNode;
  extra?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</div>
      {extra && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{extra}</p>}
    </div>
  );
}

function AnswerDisplay({ row }: { row: InspectionResponseRow | undefined }) {
  if (!row) return <span className="text-xs text-slate-400">Not answered</span>;
  const failTone: 'red' | 'amber' | 'green' | 'slate' | 'blue' =
    row.isFail && row.isSafetyCritical
      ? 'red'
      : row.isFail
        ? 'amber'
        : 'green';

  let content: React.ReactNode = '—';
  switch (row.questionType) {
    case 'PASS_FAIL':
    case 'YES_NO':
    case 'DROPDOWN':
    case 'RADIO':
      content = row.valueString ?? '—';
      break;
    case 'CHECKBOX': {
      if (!row.valueString) {
        content = '—';
        break;
      }
      try {
        const arr = JSON.parse(row.valueString);
        content = Array.isArray(arr) && arr.length > 0
          ? arr.join(', ')
          : '—';
      } catch {
        content = row.valueString;
      }
      break;
    }
    case 'NUMERIC':
      content =
        row.valueNumeric != null
          ? `${row.valueNumeric}${row.numericUnit ? ' ' + row.numericUnit : ''}`
          : '—';
      break;
    case 'TEXT':
    case 'REMARKS':
      content = row.valueString ?? '—';
      break;
    case 'DATE':
      content = row.valueDate
        ? new Date(row.valueDate).toLocaleDateString()
        : '—';
      break;
    case 'PHOTO':
      content = `${row.attachments.length} photo${row.attachments.length === 1 ? '' : 's'}`;
      break;
  }
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {row.isFail || row.questionType === 'PASS_FAIL' || row.questionType === 'YES_NO' ? (
        <Badge tone={failTone}>{typeof content === 'string' ? content : '—'}</Badge>
      ) : (
        <span className="text-sm text-slate-800 dark:text-slate-200">{content}</span>
      )}
    </span>
  );
}
