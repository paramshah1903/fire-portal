import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createTemplate,
  listTemplates,
  type ChecklistTemplateSummary,
  type TemplateCreateInput,
} from '../lib/apiChecklists';
import { listEquipmentTypes, type EquipmentType } from '../lib/apiEquipment';
import { listUnits, type Unit } from '../lib/apiUnits';
import { PERMS } from '../lib/permissions';
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
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission(PERMS.CHECKLIST_MANAGE);

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
            <label className="flex items-center gap-2 text-xs text-slate-600">
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
        <p className="text-sm text-slate-500">Loading templates…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No checklist templates"
          description="Create one to start defining monthly inspections."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
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
            <tbody className="divide-y divide-slate-200">
              {rows.map((t) => {
                const current = t.versions.find((v) => v.isCurrent);
                const draft = t.versions.find((v) => v.status === 'DRAFT');
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">
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
                        <span className="text-xs text-slate-500">
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
                    <Td>{t.frequencyDays} days</Td>
                    <Td>
                      {t.isActive ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="slate">Inactive</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate(`/checklist-templates/${t.id}`)
                        }
                      >
                        Open
                      </Button>
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
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 ${className}`}>{children}</td>;
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
    frequencyDays: 30,
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
      frequencyDays: 30,
      applicableUnitIds: [],
    });
    listEquipmentTypes().then(setTypes).catch(() => setTypes([]));
    listUnits().then(setUnits).catch(() => setUnits([]));
  }, [open]);

  // Auto-fill frequencyDays when the type changes.
  useEffect(() => {
    if (!form.equipmentTypeId) return;
    const t = types.find((x) => x.id === form.equipmentTypeId);
    if (t) setForm((f) => ({ ...f, frequencyDays: t.inspectionFrequencyDays }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.equipmentTypeId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: TemplateCreateInput = {
        name: form.name,
        description: form.description || null,
        equipmentTypeId: form.equipmentTypeId,
        frequencyDays: form.frequencyDays,
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
        <Input
          label="Frequency (days)"
          name="frequencyDays"
          type="number"
          min={1}
          max={3650}
          value={form.frequencyDays}
          onChange={(e) =>
            setForm({
              ...form,
              frequencyDays: Number.parseInt(e.target.value, 10) || 30,
            })
          }
        />
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
          <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
            Applicable units
          </p>
          <p className="mb-2 text-xs text-slate-500">
            Leave all unchecked to apply this template to every unit.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {units.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
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
