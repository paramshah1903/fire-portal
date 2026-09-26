import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  EQUIPMENT_STATUS_LABELS,
  getEquipment,
  type Equipment,
  type EquipmentStatus,
} from '../lib/apiEquipment';
import {
  getApplicableChecklistForEquipment,
  QUESTION_TYPE_LABELS,
  type ApplicableChecklist,
} from '../lib/apiChecklists';
import {
  getCurrentInspectionForEquipment,
  listInspectionsForEquipment,
  startInspection,
  type CurrentInspectionResult,
  type InspectionListItem,
} from '../lib/apiInspections';
import {
  listCorrectiveActionsForEquipment,
  CA_STATUS_LABELS,
  type CorrectiveActionListItem,
} from '../lib/apiCorrectiveActions';
import { PriorityBadge, StatusBadge } from './CorrectiveActionsPage';
import { PERMS } from '../lib/permissions';
import { Badge, Button, ErrorBanner, PageHeader } from '../components/ui';
import { EquipmentFormModal } from './EquipmentFormModal';
import { QrCodeCard } from '../components/QrCodeCard';

function statusTone(status: EquipmentStatus): 'green' | 'amber' | 'red' | 'slate' {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'UNDER_MAINTENANCE':
      return 'amber';
    case 'OUT_OF_SERVICE':
      return 'red';
    case 'RETIRED':
      return 'slate';
  }
}

type Tab = 'overview' | 'qr' | 'history' | 'checklist' | 'actions';

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.EQUIPMENT_MANAGE);
  const canPerform = hasPermission(PERMS.INSPECTION_PERFORM);

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [currentInsp, setCurrentInsp] =
    useState<CurrentInspectionResult | null>(null);
  const [startingInspection, setStartingInspection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const reload = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const eq = await getEquipment(id);
      setEquipment(eq);
      if (canPerform) {
        try {
          setCurrentInsp(await getCurrentInspectionForEquipment(eq.id));
        } catch {
          setCurrentInsp(null);
        }
      }
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, [id, canPerform]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onInspectNow() {
    if (!equipment || !currentInsp) return;
    if (currentInsp.inspection) {
      const insp = currentInsp.inspection;
      if (insp.status === 'COMPLETED') {
        navigate(`/inspections/${insp.id}`);
      } else {
        navigate(`/inspections/${insp.id}/perform`);
      }
      return;
    }
    setStartingInspection(true);
    setError(null);
    try {
      const insp = await startInspection(equipment.id);
      navigate(`/inspections/${insp.id}/perform`);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setStartingInspection(false);
    }
  }

  if (error && !equipment) {
    return (
      <div>
        <PageHeader title="Equipment" />
        <ErrorBanner message={error} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/equipment')}>
            Back to equipment
          </Button>
        </div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div>
        <PageHeader title="Equipment" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={equipment.name}
        description={
          <>
            <span className="font-mono">{equipment.equipmentCode}</span>{' '}
            · <span className="font-mono">{equipment.qrCodeValue}</span> ·{' '}
            {equipment.equipmentType.name}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/equipment')}>
              Back
            </Button>
            {canPerform && currentInsp?.eligibleToStart && (
              <Button
                onClick={onInspectNow}
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
            )}
            {canManage && (
              <Button
                variant={canPerform && currentInsp?.eligibleToStart ? 'secondary' : 'primary'}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={tab === 'qr'} onClick={() => setTab('qr')}>
          QR Code
        </TabButton>
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
        >
          Inspection History
        </TabButton>
        <TabButton
          active={tab === 'checklist'}
          onClick={() => setTab('checklist')}
        >
          Current Checklist
        </TabButton>
        <TabButton
          active={tab === 'actions'}
          onClick={() => setTab('actions')}
        >
          Corrective Actions
        </TabButton>
      </div>

      {tab === 'overview' && <OverviewPanel equipment={equipment} />}
      {tab === 'qr' && <QrCodeCard equipment={equipment} />}
      {tab === 'history' && (
        <InspectionHistoryPanel equipmentId={equipment.id} />
      )}
      {tab === 'checklist' && (
        <ApplicableChecklistPanel equipmentId={equipment.id} />
      )}
      {tab === 'actions' && (
        <CorrectiveActionsPanel equipmentId={equipment.id} />
      )}

      <EquipmentFormModal
        open={editing}
        equipment={equipment}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-brand-600 text-brand-800'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function OverviewPanel({ equipment }: { equipment: Equipment }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Section title="Identification">
          <FieldGrid
            fields={[
              ['Equipment code', equipment.equipmentCode, true],
              ['QR value', equipment.qrCodeValue, true],
              ['Name', equipment.name],
              ['Type', equipment.equipmentType.name],
              ['Serial number', equipment.serialNumber ?? '—'],
              ['Asset number', equipment.assetNumber ?? '—'],
              ['Manufacturer', equipment.manufacturer ?? '—'],
              ['Model', equipment.model ?? '—'],
              ['Capacity', equipment.capacity ?? '—'],
              [
                'Installation date',
                equipment.installationDate
                  ? new Date(equipment.installationDate).toLocaleDateString()
                  : '—',
              ],
            ]}
          />
        </Section>
        <Section title="Location">
          <FieldGrid
            fields={[
              ['Unit', `${equipment.unit.code} — ${equipment.unit.name}`],
              [
                'Department',
                equipment.department
                  ? `${equipment.department.code} — ${equipment.department.name}`
                  : '—',
              ],
              ['Area', equipment.area ?? '—'],
              ['Building', equipment.building ?? '—'],
              ['Floor', equipment.floor ?? '—'],
              ['Location', equipment.location ?? '—'],
              ['Exact location', equipment.exactLocation ?? '—'],
            ]}
          />
        </Section>
      </div>
      <div className="space-y-4">
        <Section title="Status">
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Operational
              </span>
              <div className="mt-1">
                <Badge tone={statusTone(equipment.status)}>
                  {EQUIPMENT_STATUS_LABELS[equipment.status]}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Active
              </span>
              <div className="mt-1">
                {equipment.isActive ? (
                  <Badge tone="green">Yes</Badge>
                ) : (
                  <Badge tone="slate">No</Badge>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Inspection frequency
              </span>
              <p className="mt-1 text-sm text-slate-800">
                Every {equipment.equipmentType.inspectionFrequencyDays} days
              </p>
            </div>
          </div>
        </Section>
        <Section title="Audit">
          <FieldGrid
            fields={[
              [
                'Created',
                new Date(equipment.createdAt).toLocaleString(),
              ],
              [
                'Updated',
                new Date(equipment.updatedAt).toLocaleString(),
              ],
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

function CorrectiveActionsPanel({ equipmentId }: { equipmentId: string }) {
  const [rows, setRows] = useState<CorrectiveActionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCorrectiveActionsForEquipment(equipmentId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((err) => {
        if (!cancelled) setError(toApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (error) {
    return (
      <Section title="Corrective actions">
        <ErrorBanner message={error} />
      </Section>
    );
  }
  if (rows === null) {
    return (
      <Section title="Corrective actions">
        <p className="text-sm text-slate-500">Loading…</p>
      </Section>
    );
  }
  if (rows.length === 0) {
    return (
      <Section title="Corrective actions">
        <p className="text-sm text-slate-600">
          No corrective actions have been raised for this equipment.
        </p>
      </Section>
    );
  }
  return (
    <Section title="Corrective actions">
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Code
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Title
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Priority
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Assignee
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Target
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2 font-medium text-slate-900">
                  {r.title}
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={r.priority} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2">
                  {r.assignee?.fullName ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {r.targetDate
                    ? new Date(r.targetDate).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/corrective-actions/${r.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {rows.filter((r) => r.status !== 'CLOSED').length} open,{' '}
        {rows.filter((r) => r.status === 'CLOSED').length} closed. Status
        labels: {Object.values(CA_STATUS_LABELS).join(', ')}.
      </p>
    </Section>
  );
}

function InspectionHistoryPanel({ equipmentId }: { equipmentId: string }) {
  const [rows, setRows] = useState<InspectionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listInspectionsForEquipment(equipmentId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((err) => {
        if (!cancelled) setError(toApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (error) {
    return (
      <Section title="Inspection history">
        <ErrorBanner message={error} />
      </Section>
    );
  }
  if (rows === null) {
    return (
      <Section title="Inspection history">
        <p className="text-sm text-slate-500">Loading…</p>
      </Section>
    );
  }
  if (rows.length === 0) {
    return (
      <Section title="Inspection history">
        <p className="text-sm text-slate-600">
          No inspections have been performed on this equipment yet.
        </p>
      </Section>
    );
  }
  return (
    <Section title="Inspection history">
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Period
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Template
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Result
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Inspector
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Completed
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{r.periodKey}</td>
                <td className="px-3 py-2 text-slate-700">
                  {r.templateVersion.template.name} v{r.templateVersion.versionNumber}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={r.status === 'COMPLETED' ? 'green' : 'amber'}>
                    {r.status === 'COMPLETED' ? 'Completed' : 'In progress'}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {r.result ? (
                    <Badge
                      tone={
                        r.hasSafetyCriticalFailure
                          ? 'red'
                          : r.result === 'FAIL'
                            ? 'amber'
                            : 'green'
                      }
                    >
                      {r.result}
                      {r.hasSafetyCriticalFailure ? ' · SC' : ''}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">{r.inspector.fullName}</td>
                <td className="px-3 py-2">
                  {r.completedAt
                    ? new Date(r.completedAt).toLocaleString()
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={
                      r.status === 'COMPLETED'
                        ? `/inspections/${r.id}`
                        : `/inspections/${r.id}/perform`
                    }
                    className="text-brand-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ApplicableChecklistPanel({ equipmentId }: { equipmentId: string }) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'none' }
    | { kind: 'ok'; checklist: ApplicableChecklist }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getApplicableChecklistForEquipment(equipmentId)
      .then((res) => {
        if (cancelled) return;
        if (!res) setState({ kind: 'none' });
        else setState({ kind: 'ok', checklist: res });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ kind: 'error', message: toApiError(err).message });
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (state.kind === 'loading') {
    return (
      <Section title="Assigned checklist">
        <p className="text-sm text-slate-500">Loading…</p>
      </Section>
    );
  }
  if (state.kind === 'error') {
    return (
      <Section title="Assigned checklist">
        <ErrorBanner message={state.message} />
      </Section>
    );
  }
  if (state.kind === 'none') {
    return (
      <Section title="Assigned checklist">
        <p className="text-sm text-slate-600">
          No published checklist template applies to this equipment yet.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          A Central or Super Admin can create one under{' '}
          <Link
            to="/checklist-templates"
            className="text-brand-700 hover:underline"
          >
            Checklist Templates
          </Link>
          .
        </p>
      </Section>
    );
  }

  const { checklist } = state;
  return (
    <Section title="Assigned checklist">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link
          to={`/checklist-templates/${checklist.template.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {checklist.template.name}
        </Link>
        <Badge tone="green">v{checklist.version.versionNumber}</Badge>
        <span className="text-slate-500">
          · every {checklist.template.frequencyDays} days
        </span>
      </div>
      {checklist.template.description && (
        <p className="mb-4 text-sm text-slate-600">
          {checklist.template.description}
        </p>
      )}
      <div className="space-y-4">
        {checklist.version.sections.map((section, si) => (
          <div key={si} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">
              {si + 1}. {section.title}
            </p>
            {section.description && (
              <p className="mt-1 text-xs text-slate-600">
                {section.description}
              </p>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {section.questions.map((q, qi) => (
                <li key={qi} className="flex items-start gap-2">
                  <span className="text-xs text-slate-400">
                    {si + 1}.{qi + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-800">{q.text}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="blue">
                        {QUESTION_TYPE_LABELS[q.questionType]}
                      </Badge>
                      {q.isMandatory && <Badge tone="slate">Mandatory</Badge>}
                      {q.isSafetyCritical && (
                        <Badge tone="red">Safety-critical</Badge>
                      )}
                      {q.requiresCorrectiveActionOnFail && (
                        <Badge tone="amber">Auto CA on fail</Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function FieldGrid({
  fields,
}: {
  fields: Array<[string, React.ReactNode, boolean?]>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([label, value, mono]) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            {label}
          </dt>
          <dd
            className={`mt-0.5 text-sm text-slate-900 ${
              mono ? 'font-mono' : ''
            }`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
