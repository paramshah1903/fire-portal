import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  type ChecklistTemplateSummary,
  type TemplateCreateInput,
} from '../lib/apiChecklists';
import { listEquipmentTypes, type EquipmentType } from '../lib/apiEquipment';
import { listUnits, type Unit } from '../lib/apiUnits';
import { PERMS, ROLES } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';

export function ChecklistTemplatesPage() {
  const { hasPermission, user: me } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission(PERMS.CHECKLIST_MANAGE);
  const isSuperAdmin = me?.roleKey === ROLES.SUPER_ADMIN;
  const [busy, setBusy] = useState<string | null>(null);

  async function onDelete(t: ChecklistTemplateSummary) {
    if (
      !confirm(
        `Permanently delete template "${t.name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(t.id);
    setError(null);
    try {
      await deleteTemplate(t.id);
      await reload();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  const [rows, setRows] = useState<ChecklistTemplateSummary[] | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setError(null);
    try {
      setRows(await listTemplates(includeInactive));
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  return (
    <div>
      <PageHeader
        title="Checklist Templates"
        description="Inspection templates per equipment type. Templates are versioned — historical inspections keep the version they were captured against."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Show inactive
            </label>
            {canManage && (
              <Button onClick={() => setCreating(true)}>New template</Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading templates…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No checklist templates"
          description="Create one to start defining monthly inspections."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Name</Th>
                <Th>Equipment type</Th>
                <Th>Current version</Th>
                <Th>Draft</Th>
                <Th>Applicable units</Th>
                <Th>Frequency</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((t) => {
                const current = t.versions.find((v) => v.isCurrent);
                const draft = t.versions.find((v) => v.status === 'DRAFT');
                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      <Link
                        to={`/checklist-templates/${t.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {t.name}
                      </Link>
                    </Td>
                    <Td>{t.equipmentType.name}</Td>
                    <Td>
                      {current ? (
                        <Badge tone="green">v{current.versionNumber}</Badge>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          not published
                        </span>
                      )}
                    </Td>
                    <Td>
                      {draft ? (
                        <Badge tone="amber">v{draft.versionNumber}</Badge>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="font-mono text-xs">
                      {t.applicableUnits.length === 0
                        ? 'All units'
                        : t.applicableUnits.map((au) => au.unit.code).join(', ')}
                    </Td>
                    <Td>
                      {t.frequencyDays != null ? (
                        `${t.frequencyDays} days`
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Type default
                        </span>
                      )}
                    </Td>
                    <Td>
                      {t.isActive ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="slate">Inactive</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate(`/checklist-templates/${t.id}`)
                        }
                      >
                        Open
                      </Button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => void onDelete(t)}
                          className="ml-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
                          title="Only allowed if no inspection has used this template."
                        >
                          {busy === t.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TemplateFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(created) => {
          setCreating(false);
          if (created) navigate(`/checklist-templates/${created.id}`);
          else void reload();
        }}
      />
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>{children}</td>;
}

function TemplateFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created: ChecklistTemplateSummary | null) => void;
}) {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    equipmentTypeId: '',
    // Empty string = "not specified"; falls back to equipment type default at inspection time.
    frequencyDays: '' as '' | number,
    headerText: '',
    footerText: '',
    signatureLine: '',
    applicableUnitIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: '',
      description: '',
      equipmentTypeId: '',
      frequencyDays: '',
      headerText: '',
      footerText: '',
      signatureLine: '',
      applicableUnitIds: [],
    });
    listEquipmentTypes().then(setTypes).catch(() => setTypes([]));
    listUnits().then(setUnits).catch(() => setUnits([]));
  }, [open]);

  const selectedType = types.find((x) => x.id === form.equipmentTypeId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: TemplateCreateInput = {
        name: form.name,
        description: form.description || null,
        equipmentTypeId: form.equipmentTypeId,
        frequencyDays:
          typeof form.frequencyDays === 'number' ? form.frequencyDays : undefined,
        headerText: form.headerText.trim() || null,
        footerText: form.footerText.trim() || null,
        signatureLine: form.signatureLine.trim() || null,
        applicableUnitIds:
          form.applicableUnitIds.length > 0
            ? form.applicableUnitIds
            : undefined,
      };
      const saved = await createTemplate(payload);
      onSaved(saved);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

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
      title="New checklist template"
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cl-template-form" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create template'}
          </Button>
        </>
      }
    >
      <form
        id="cl-template-form"
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
        <Select
          label="Equipment type"
          name="equipmentTypeId"
          required
          value={form.equipmentTypeId}
          onChange={(e) =>
            setForm({ ...form, equipmentTypeId: e.target.value })
          }
        >
          <option value="">Select a type…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <div>
          <Input
            label="Frequency (days, optional)"
            name="frequencyDays"
            type="number"
            min={1}
            max={3650}
            placeholder={
              selectedType
                ? `Type default: ${selectedType.inspectionFrequencyDays}`
                : 'Leave blank to use equipment type default'
            }
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
            Leave blank to use the equipment type&apos;s default frequency.
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
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Shown at the top of the perform page and on the PDF export.
          </p>
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
        {error && (
          <div className="sm:col-span-2">
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}
