import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  caAttachmentUrl,
  CA_PRIORITIES,
  CA_PRIORITY_LABELS,
  closeCa,
  getCorrectiveAction,
  markCaInProgress,
  markCaResolved,
  updateCorrectiveAction,
  uploadCaAttachment,
  type CaAttachmentStage,
  type CaPriority,
  type CorrectiveActionDetail,
  type UpdateInput,
} from '../lib/apiCorrectiveActions';
import { listUsers, type UserRow } from '../lib/apiUsers';
import { PERMS } from '../lib/permissions';
import {
  Button,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';
import { PriorityBadge, StatusBadge } from './CorrectiveActionsPage';

export function CorrectiveActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.CORRECTIVE_ACTION_CREATE);
  const canClose = hasPermission(PERMS.CORRECTIVE_ACTION_CLOSE);

  const [ca, setCa] = useState<CorrectiveActionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setCa(await getCorrectiveAction(id));
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkInProgress() {
    if (!ca) return;
    setBusy(true);
    setError(null);
    try {
      await markCaInProgress(ca.id);
      await load();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File, stage: CaAttachmentStage) {
    if (!ca) return;
    setBusy(true);
    setError(null);
    try {
      await uploadCaAttachment(ca.id, file, { stage });
      await load();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !ca) {
    return (
      <div>
        <PageHeader title="Corrective action" />
        <ErrorBanner message={error} />
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/corrective-actions')}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }
  if (!ca) {
    return (
      <div>
        <PageHeader title="Corrective action" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const isClosed = ca.status === 'CLOSED';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={ca.title}
        description={
          <>
            <span className="font-mono">{ca.code}</span> ·{' '}
            <Link
              to={`/equipment/${ca.equipment.id}`}
              className="text-brand-700 hover:underline"
            >
              {ca.equipment.equipmentCode} — {ca.equipment.name}
            </Link>
            {ca.sourceInspection && (
              <>
                {' '}
                ·{' '}
                <Link
                  to={`/inspections/${ca.sourceInspection.id}`}
                  className="text-brand-700 hover:underline"
                >
                  from inspection {ca.sourceInspection.periodKey}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate('/corrective-actions')}
            >
              Back
            </Button>
            {canManage && !isClosed && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card label="Status" value={<StatusBadge status={ca.status} />} />
        <Card
          label="Priority"
          value={<PriorityBadge priority={ca.priority} />}
        />
        <Card
          label="Target date"
          value={
            ca.targetDate ? new Date(ca.targetDate).toLocaleDateString() : '—'
          }
          extra={
            ca.targetDate && new Date(ca.targetDate) < new Date() && !isClosed
              ? 'Overdue'
              : undefined
          }
        />
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">
          Description
        </h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {ca.description}
        </p>
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PeoplePanel ca={ca} />
        <TimelinePanel ca={ca} />
      </section>

      {ca.resolutionRemarks && (
        <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <h2 className="mb-1 text-sm font-semibold text-emerald-900">
            Resolution remarks
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-800">
            {ca.resolutionRemarks}
          </p>
        </section>
      )}
      {ca.closureRemarks && (
        <section className="mb-4 rounded-lg border border-slate-300 bg-slate-100 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            Closure remarks
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-800">
            {ca.closureRemarks}
          </p>
        </section>
      )}

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Attachments / evidence
          </h2>
          {canManage && !isClosed && (
            <>
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {busy ? 'Uploading…' : 'Add evidence'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const stage: CaAttachmentStage =
                      ca.status === 'RESOLVED'
                        ? 'RESOLUTION'
                        : ca.status === 'CLOSED'
                          ? 'CLOSURE'
                          : 'EVIDENCE';
                    void onUpload(f, stage);
                    if (fileRef.current) fileRef.current.value = '';
                  }
                }}
              />
            </>
          )}
        </div>
        {ca.attachments.length === 0 ? (
          <p className="text-sm text-slate-500">
            No evidence attached yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {ca.attachments.map((a) => (
              <a
                key={a.id}
                href={caAttachmentUrl(a.id)}
                target="_blank"
                rel="noopener"
                className="block w-32 overflow-hidden rounded border border-slate-200 bg-white"
                title={`${a.stage} · ${a.originalName}`}
              >
                <img
                  src={caAttachmentUrl(a.id)}
                  alt={a.caption ?? a.originalName}
                  className="h-24 w-full object-cover"
                />
                <div className="px-2 py-1 text-[10px] text-slate-600">
                  <p className="font-semibold uppercase tracking-widest">
                    {a.stage}
                  </p>
                  <p className="truncate">{a.originalName}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Lifecycle actions */}
      {!isClosed && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Lifecycle
          </h2>
          <div className="flex flex-wrap gap-2">
            {canManage && ca.status === 'OPEN' && (
              <Button onClick={onMarkInProgress} disabled={busy}>
                Mark as in progress
              </Button>
            )}
            {canManage &&
              (ca.status === 'OPEN' || ca.status === 'IN_PROGRESS') && (
                <Button
                  variant={ca.status === 'IN_PROGRESS' ? 'primary' : 'secondary'}
                  onClick={() => setResolving(true)}
                  disabled={busy}
                >
                  Mark as resolved
                </Button>
              )}
            {canClose && ca.status === 'RESOLVED' && (
              <Button
                variant="primary"
                onClick={() => setClosing(true)}
                disabled={busy}
              >
                Close corrective action
              </Button>
            )}
            {!canClose && ca.status === 'RESOLVED' && (
              <p className="text-xs text-slate-500">
                Waiting for closure by an authorised user.
              </p>
            )}
          </div>
        </section>
      )}

      <EditModal
        open={editing}
        ca={ca}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void load();
        }}
      />
      <ResolveModal
        open={resolving}
        ca={ca}
        onClose={() => setResolving(false)}
        onDone={() => {
          setResolving(false);
          void load();
        }}
      />
      <CloseModal
        open={closing}
        ca={ca}
        onClose={() => setClosing(false)}
        onDone={() => {
          setClosing(false);
          void load();
        }}
      />
    </div>
  );
}

// ============================================================================

function Card({
  label,
  value,
  extra,
}: {
  label: string;
  value: React.ReactNode;
  extra?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
      {extra && (
        <p className="mt-1 text-xs font-semibold text-red-700">{extra}</p>
      )}
    </div>
  );
}

function PeoplePanel({ ca }: { ca: CorrectiveActionDetail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">People</h2>
      <dl className="grid grid-cols-1 gap-2 text-sm">
        <Row
          label="Raised by"
          value={`${ca.raisedBy.fullName} (${ca.raisedBy.username})`}
        />
        <Row
          label="Assignee"
          value={
            ca.assignee
              ? `${ca.assignee.fullName} (${ca.assignee.username})`
              : 'Unassigned'
          }
        />
        {ca.resolvedBy && (
          <Row
            label="Resolved by"
            value={`${ca.resolvedBy.fullName} (${ca.resolvedBy.username})`}
          />
        )}
        {ca.closedBy && (
          <Row
            label="Closed by"
            value={`${ca.closedBy.fullName} (${ca.closedBy.username})`}
          />
        )}
      </dl>
    </div>
  );
}

function TimelinePanel({ ca }: { ca: CorrectiveActionDetail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Timeline</h2>
      <ul className="space-y-2 text-sm">
        <TimelineItem
          when={ca.raisedAt}
          label="Raised"
          detail={ca.raisedBy.fullName}
        />
        {ca.resolvedAt && (
          <TimelineItem
            when={ca.resolvedAt}
            label="Resolved"
            detail={ca.resolvedBy?.fullName}
          />
        )}
        {ca.closedAt && (
          <TimelineItem
            when={ca.closedAt}
            label="Closed"
            detail={ca.closedBy?.fullName}
          />
        )}
        {ca.sourceInspection && (
          <li className="flex items-start gap-2 text-xs text-slate-500">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
            <div>
              Auto-created from inspection period{' '}
              <span className="font-mono">
                {ca.sourceInspection.periodKey}
              </span>
              {ca.sourceInspection.hasSafetyCriticalFailure &&
                ' (safety-critical failure)'}
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function TimelineItem({
  when,
  label,
  detail,
}: {
  when: string;
  label: string;
  detail?: string | null;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500" />
      <div>
        <p className="text-slate-900">
          <span className="font-medium">{label}</span> —{' '}
          <span className="text-slate-500">
            {new Date(when).toLocaleString()}
          </span>
        </p>
        {detail && <p className="text-xs text-slate-600">by {detail}</p>}
      </div>
    </li>
  );
}

// ============================================================================
// Edit modal
// ============================================================================

function EditModal({
  open,
  ca,
  onClose,
  onSaved,
}: {
  open: boolean;
  ca: CorrectiveActionDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: ca.title,
    description: ca.description,
    priority: ca.priority,
    assigneeId: ca.assignee?.id ?? '',
    targetDate: ca.targetDate ? ca.targetDate.slice(0, 10) : '',
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: ca.title,
      description: ca.description,
      priority: ca.priority,
      assigneeId: ca.assignee?.id ?? '',
      targetDate: ca.targetDate ? ca.targetDate.slice(0, 10) : '',
    });
    setError(null);
    listUsers({ unitId: ca.unit.id }).then(setUsers).catch(() => setUsers([]));
  }, [open, ca]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: UpdateInput = {
        title: form.title,
        description: form.description,
        priority: form.priority as CaPriority,
        assigneeId: form.assigneeId || null,
        targetDate: form.targetDate || null,
      };
      await updateCorrectiveAction(ca.id, payload);
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Edit corrective action"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ca-edit-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="ca-edit-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Input
            label="Title"
            required
            maxLength={300}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label="Description"
            rows={4}
            required
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
        </div>
        <Select
          label="Priority"
          value={form.priority}
          onChange={(e) =>
            setForm({ ...form, priority: e.target.value as CaPriority })
          }
        >
          {CA_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {CA_PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        <Input
          label="Target date"
          type="date"
          value={form.targetDate}
          onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
        />
        <div className="sm:col-span-2">
          <Select
            label="Assignee"
            value={form.assigneeId}
            onChange={(e) =>
              setForm({ ...form, assigneeId: e.target.value })
            }
          >
            <option value="">— unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.username})
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <div className="sm:col-span-2">
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================================
// Resolve / Close modals
// ============================================================================

function ResolveModal({
  open,
  ca,
  onClose,
  onDone,
}: {
  open: boolean;
  ca: CorrectiveActionDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRemarks('');
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await markCaResolved(ca.id, remarks);
      onDone();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark as resolved"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="ca-resolve-form"
            disabled={busy || !remarks.trim()}
          >
            {busy ? 'Resolving…' : 'Mark resolved'}
          </Button>
        </>
      }
    >
      <form id="ca-resolve-form" onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-700">
          Describe what was done to resolve this corrective action. A
          supervisor with closure rights will verify and close it.
        </p>
        <TextArea
          label="Resolution remarks"
          rows={5}
          required
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        {error && <ErrorBanner message={error} />}
      </form>
    </Modal>
  );
}

function CloseModal({
  open,
  ca,
  onClose,
  onDone,
}: {
  open: boolean;
  ca: CorrectiveActionDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRemarks('');
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await closeCa(ca.id, remarks);
      onDone();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Close corrective action"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="ca-close-form"
            disabled={busy || !remarks.trim()}
          >
            {busy ? 'Closing…' : 'Close CA'}
          </Button>
        </>
      }
    >
      <form id="ca-close-form" onSubmit={onSubmit} className="space-y-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Once closed, this corrective action cannot be edited or reopened.
        </div>
        <TextArea
          label="Closure remarks"
          rows={4}
          required
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        {error && <ErrorBanner message={error} />}
      </form>
    </Modal>
  );
}
