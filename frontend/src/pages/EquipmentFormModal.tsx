import { useEffect, useState } from 'react';
import { toApiError } from '../lib/api';
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUSES,
  createEquipment,
  listEquipmentTypes,
  updateEquipment,
  type Equipment,
  type EquipmentInput,
  type EquipmentStatus,
  type EquipmentType,
} from '../lib/apiEquipment';
import {
  listDepartments,
  listUnits,
  type Department,
  type Unit,
} from '../lib/apiUnits';
import { Button, ErrorBanner, Input, Select } from '../components/ui';
import { Modal } from '../components/Modal';

interface FormState {
  equipmentCode: string;
  name: string;
  equipmentTypeId: string;
  unitId: string;
  departmentId: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  capacity: string;
  assetNumber: string;
  installationDate: string;
  area: string;
  building: string;
  floor: string;
  location: string;
  exactLocation: string;
  status: EquipmentStatus;
  isActive: boolean;
}

function initialFrom(item?: Equipment | null): FormState {
  return {
    equipmentCode: item?.equipmentCode ?? '',
    name: item?.name ?? '',
    equipmentTypeId: item?.equipmentType.id ?? '',
    unitId: item?.unit.id ?? '',
    departmentId: item?.department?.id ?? '',
    serialNumber: item?.serialNumber ?? '',
    manufacturer: item?.manufacturer ?? '',
    model: item?.model ?? '',
    capacity: item?.capacity ?? '',
    assetNumber: item?.assetNumber ?? '',
    installationDate: item?.installationDate
      ? item.installationDate.slice(0, 10)
      : '',
    area: item?.area ?? '',
    building: item?.building ?? '',
    floor: item?.floor ?? '',
    location: item?.location ?? '',
    exactLocation: item?.exactLocation ?? '',
    status: item?.status ?? 'ACTIVE',
    isActive: item?.isActive ?? true,
  };
}

export function EquipmentFormModal({
  open,
  equipment,
  onClose,
  onSaved,
}: {
  open: boolean;
  equipment?: Equipment | null;
  onClose: () => void;
  onSaved: (saved: Equipment | null) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialFrom(equipment));
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialFrom(equipment));
    setError(null);
    listEquipmentTypes().then(setTypes).catch(() => setTypes([]));
    listUnits().then(setUnits).catch(() => setUnits([]));
  }, [open, equipment]);

  useEffect(() => {
    if (!form.unitId) {
      setDepartments([]);
      return;
    }
    listDepartments(form.unitId)
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [form.unitId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: EquipmentInput = {
        equipmentCode: form.equipmentCode,
        name: form.name,
        equipmentTypeId: form.equipmentTypeId,
        unitId: form.unitId,
        departmentId: form.departmentId || null,
        serialNumber: form.serialNumber || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        capacity: form.capacity || null,
        assetNumber: form.assetNumber || null,
        installationDate: form.installationDate || null,
        area: form.area || null,
        building: form.building || null,
        floor: form.floor || null,
        location: form.location || null,
        exactLocation: form.exactLocation || null,
        status: form.status,
        isActive: form.isActive,
      };
      const saved = equipment
        ? await updateEquipment(equipment.id, payload)
        : await createEquipment(payload);
      onSaved(saved);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={equipment ? `Edit equipment ${equipment.equipmentCode}` : 'New equipment'}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="eq-form" disabled={submitting}>
            {submitting
              ? 'Saving…'
              : equipment
                ? 'Save changes'
                : 'Create equipment'}
          </Button>
        </>
      }
    >
      <form
        id="eq-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Input
          label="Equipment code"
          name="equipmentCode"
          required
          maxLength={64}
          value={form.equipmentCode}
          onChange={(e) => setForm({ ...form, equipmentCode: e.target.value })}
          hint="Unique. Uppercased automatically. E.g. FE-A-0001."
        />
        <Input
          label="Name"
          name="name"
          required
          maxLength={200}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Select
          label="Type"
          name="equipmentTypeId"
          required
          value={form.equipmentTypeId}
          onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value })}
        >
          <option value="">Select a type…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          name="status"
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value as EquipmentStatus })
          }
        >
          {EQUIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {EQUIPMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Unit"
          name="unitId"
          required
          value={form.unitId}
          onChange={(e) =>
            setForm({ ...form, unitId: e.target.value, departmentId: '' })
          }
        >
          <option value="">Select a unit…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
        <Select
          label="Department"
          name="departmentId"
          value={form.departmentId}
          disabled={!form.unitId}
          onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
        >
          <option value="">— none —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </Select>
        <Input
          label="Serial number"
          name="serialNumber"
          value={form.serialNumber}
          onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
        />
        <Input
          label="Asset number"
          name="assetNumber"
          value={form.assetNumber}
          onChange={(e) => setForm({ ...form, assetNumber: e.target.value })}
        />
        <Input
          label="Manufacturer"
          name="manufacturer"
          value={form.manufacturer}
          onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
        />
        <Input
          label="Model"
          name="model"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
        />
        <Input
          label="Capacity"
          name="capacity"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
        <Input
          label="Installation date"
          name="installationDate"
          type="date"
          value={form.installationDate}
          onChange={(e) =>
            setForm({ ...form, installationDate: e.target.value })
          }
        />
        <Input
          label="Area"
          name="area"
          value={form.area}
          onChange={(e) => setForm({ ...form, area: e.target.value })}
        />
        <Input
          label="Building"
          name="building"
          value={form.building}
          onChange={(e) => setForm({ ...form, building: e.target.value })}
        />
        <Input
          label="Floor"
          name="floor"
          value={form.floor}
          onChange={(e) => setForm({ ...form, floor: e.target.value })}
        />
        <Input
          label="Location (signage)"
          name="location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <div className="sm:col-span-2">
          <Input
            label="Exact location"
            name="exactLocation"
            value={form.exactLocation}
            onChange={(e) => setForm({ ...form, exactLocation: e.target.value })}
          />
        </div>
        <label className="col-span-2 mt-1 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active (leaves this record visible in normal inspection schedules)
        </label>
        {error && (
          <div className="col-span-2">
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}
