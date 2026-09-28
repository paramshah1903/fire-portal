import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createDraftVersion,
  getTemplate,
  updateTemplate,
  type ChecklistTemplateSummary,
  type TemplateUpdateInput,
} from '../lib/apiChecklists';
import { listUnits, type Unit } from '../lib/apiUnits';
import { listUsers, type UserRow } from '../lib/apiUsers';
import { PERMS } from '../lib/permissions';
import {
  Badge,
  Button,
  ErrorBanner,
  Input,
  PageHeader,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';

export function ChecklistTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.CHECKLIST_MANAGE);

  const [template, setTemplate] = useState<ChecklistTemplateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setTemplate(await getTemplate(id));
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreateDraft() {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const v = await createDraftVersion(template.id);
      navigate(`/checklist-templates/${template.id}/versions/${v.id}`);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !template) {
    return (
      <div>
        <PageHeader title="Checklist template" />
        <ErrorBanner message={error} />
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/checklist-templates')}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }
  if (!template) {
    return (
      <div>
        <PageHeader title="Checklist template" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  const current = template.versions.find((v) => v.isCurrent);
  const draft = template.versions.find((v) => v.status === 'DRAFT');

  return (
    <div>
      <PageHeader
        title={template.name}
        description={
          template.frequencyDays != null
            ? `${template.equipmentType.name} · every ${template.frequencyDays} days`
            : `${template.equipmentType.name} · uses type default frequency`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate('/checklist-templates')}
            >
              Back
            </Button>
            {canManage && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit settings
                </Button>
                {draft ? (
                  <Button
                    onClick={() =>
                      navigate(
                        `/checklist-templates/${template.id}/versions/${draft.id}`,
                      )
                    }
                  >
                    Continue draft v{draft.versionNumber}
                  </Button>
                ) : (
                  <Button disabled={busy} onClick={onCreateDraft}>
                    {busy ? 'Creating…' : 'New draft version'}
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Versions</h2>
          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <Th>Version</Th>
                  <Th>Status</Th>
                  <Th>Published</Th>
                  <Th>Sections</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {template.versions.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Td>
                      <span className="font-mono">v{v.versionNumber}</span>
                      {v.isCurrent && (
                        <span className="ml-2">
                          <Badge tone="green">Current</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          v.status === 'DRAFT'
                            ? 'amber'
                            : v.status === 'PUBLISHED'
                              ? 'green'
                              : 'slate'
                        }
                      >
                        {v.status}
                      </Badge>
                    </Td>
                    <Td>
                      {v.publishedAt
                        ? new Date(v.publishedAt).toLocaleString()
                        : '—'}
                    </Td>
                    <Td>{v._count?.sections ?? 0}</Td>
                    <Td className="text-right">
                      <Link
                        to={`/checklist-templates/${template.id}/versions/${v.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {v.status === 'DRAFT' && canManage ? 'Edit' : 'Open'}
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
          <dl className="space-y-3 text-sm">
            <Field label="Description" value={template.description ?? '—'} />
            <Field
              label="Equipment type"
              value={
                <span className="font-mono">
                  {template.equipmentType.key}
                </span>
              }
            />
            <Field
              label="Frequency"
              value={
                template.frequencyDays != null
                  ? `${template.frequencyDays} days`
                  : 'Equipment type default'
              }
            />
            <Field
              label="Applicable units"
              value={
                template.applicableUnits.length === 0
                  ? 'All units'
                  : template.applicableUnits
                      .map((au) => au.unit.code)
                      .join(', ')
              }
            />
            <Field
              label="Status"
              value={
                template.isActive ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="slate">Inactive</Badge>
                )
              }
            />
            <Field
              label="Current version"
              value={current ? `v${current.versionNumber}` : 'None published'}
            />
          </dl>
        </section>
      </div>

      <SettingsModal
        open={editing}
        template={template}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
      />
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>
      {children}
    </td>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function SettingsModal({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: ChecklistTemplateSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [approverCandidates, setApproverCandidates] = useState<UserRow[]>([]);
  const [form, setForm] = useState({
    name: template.name,
    description: template.description ?? '',
    // Empty string = "not specified" (falls back to equipment type default).
    frequencyDays: (template.frequencyDays ?? '') as '' | number,
    headerText: template.headerText ?? '',
    footerText: template.footerText ?? '',
    signatureLine: template.signatureLine ?? '',
    applicableUnitIds: template.applicableUnits.map((au) => au.unitId),
    approverUserIds: template.approvers.map((a) => a.userId),
    isActive: template.isActive,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: template.name,
      description: template.description ?? '',
      frequencyDays: (template.frequencyDays ?? '') as '' | number,
      headerText: template.headerText ?? '',
      footerText: template.footerText ?? '',
      signatureLine: template.signatureLine ?? '',
      applicableUnitIds: template.applicableUnits.map((au) => au.unitId),
      approverUserIds: template.approvers.map((a) => a.userId),
      isActive: template.isActive,
    });
    setError(null);
    listUnits().then(setUnits).catch(() => setUnits([]));
    // Fetch users so we can filter to eligible approvers (role
    // UNIT_ADMIN / CENTRAL_ADMIN / SUPER_ADMIN).
    listUsers({}).then(setApproverCandidates).catch(() => setApproverCandidates([]));
  }, [open, template]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: TemplateUpdateInput = {
        name: form.name,
        description: form.description || null,
        // null clears back to type default; number sets an override.
        frequencyDays:
          typeof form.frequencyDays === 'number' ? form.frequencyDays : null,
        headerText: form.headerText.trim() || null,
        footerText: form.footerText.trim() || null,
        signatureLine: form.signatureLine.trim() || null,
        applicableUnitIds: form.applicableUnitIds,
        approverUserIds: form.approverUserIds,
        isActive: form.isActive,
      };
      await updateTemplate(template.id, payload);
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleApprover(id: string) {
    setForm((f) => ({
      ...f,
      approverUserIds: f.approverUserIds.includes(id)
        ? f.approverUserIds.filter((x) => x !== id)
        : [...f.approverUserIds, id],
    }));
  }

  const eligibleApprovers = approverCandidates.filter((u) =>
    ['SUPER_ADMIN', 'CENTRAL_ADMIN', 'UNIT_ADMIN'].includes(u.role.key),
  );

  function toggleUnit(id: string) {
    setForm((f) => ({
      ...f,
      applicableUnitIds: f.applicableUnitIds.includes(id)
        ? f.applicableUnitIds.filter((x) => x !== id)
        : [...f.applicableUnitIds, id],
    }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Edit template settings"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cl-settings-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="cl-settings-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Input
            label="Name"
            name="name"
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Input
            label="Frequency (days, optional)"
            name="frequencyDays"
            type="number"
            min={1}
            max={3650}
            placeholder="Leave blank for equipment type default"
            value={form.frequencyDays === '' ? '' : form.frequencyDays}
            onChange={(e) => {
              const raw = e.target.value;
              setForm({
                ...form,
                frequencyDays: raw === '' ? '' : Number.parseInt(raw, 10) || '',
              });
            }}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Blank = use the equipment type&apos;s default frequency.
          </p>
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label="Description"
            name="description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label="Printed header (optional)"
            name="headerText"
            rows={2}
            placeholder="e.g. UPL Fire Safety — Monthly Inspection Record"
            value={form.headerText}
            onChange={(e) => setForm({ ...form, headerText: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label="Printed footer (optional)"
            name="footerText"
            rows={2}
            placeholder="e.g. Confidential — internal use only"
            value={form.footerText}
            onChange={(e) => setForm({ ...form, footerText: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Signature line (optional)"
            name="signatureLine"
            placeholder={`Defaults to "Inspector's signature"`}
            value={form.signatureLine}
            onChange={(e) =>
              setForm({ ...form, signatureLine: e.target.value })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Applicable units
          </p>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Leave all unchecked to apply this template to every unit.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {units.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.applicableUnitIds.includes(u.id)}
                  onChange={() => toggleUnit(u.id)}
                />
                <span className="font-mono text-xs">{u.code}</span> — {u.name}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Approvers (optional)
          </p>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            When at least one approver is set, submitted inspections wait
            for approval before becoming a valid record. Any listed
            approver can approve. Only Unit Admin / Central Admin / Super
            Admin users are shown.
          </p>
          {eligibleApprovers.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No eligible users found.
            </p>
          ) : (
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {eligibleApprovers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.approverUserIds.includes(u.id)}
                    onChange={() => toggleApprover(u.id)}
                  />
                  <span className="flex-1">
                    {u.fullName}
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                      · {u.role.name}
                      {u.unit ? ` · ${u.unit.code}` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active (available for use by inspections)
        </label>
        {error && (
          <div className="sm:col-span-2">
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}
