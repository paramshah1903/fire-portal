import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toApiError } from '../lib/api';
import {
  getInspection,
  inspectionAttachmentUrl,
  saveInspectionProgress,
  submitInspection,
  uploadInspectionAttachment,
  type InspectionAttachment,
  type InspectionDetail,
  type InspectionEquipmentContext,
  type InspectionQuestion,
  type InspectionResponseRow,
  type SaveResponseInput,
} from '../lib/apiInspections';
import type { QuestionType } from '../lib/apiChecklists';
import { Badge, Button, ErrorBanner, Input, PageHeader, TextArea } from '../components/ui';
import { Modal } from '../components/Modal';

interface AnswerState {
  valueString?: string | null;
  valueNumeric?: number | null;
  valueDate?: string | null;
  notes?: string | null;
  attachments: InspectionAttachment[];
}

type AnswerMap = Record<string, AnswerState>;

function seedAnswers(insp: InspectionDetail): AnswerMap {
  const map: AnswerMap = {};
  for (const r of insp.responses) {
    map[r.questionId] = {
      valueString: r.valueString,
      valueNumeric: r.valueNumeric,
      valueDate: r.valueDate ? r.valueDate.slice(0, 10) : null,
      notes: r.notes,
      attachments: r.attachments,
    };
  }
  return map;
}

function isAnswered(q: InspectionQuestion, a: AnswerState | undefined): boolean {
  if (!a) return false;
  switch (q.questionType) {
    case 'PASS_FAIL':
    case 'YES_NO':
    case 'DROPDOWN':
    case 'TEXT':
    case 'REMARKS':
      return !!a.valueString && a.valueString.trim().length > 0;
    case 'NUMERIC':
      return a.valueNumeric != null;
    case 'DATE':
      return !!a.valueDate;
    case 'PHOTO':
      return a.attachments.length > 0;
    default:
      return false;
  }
}

/** Decide if an answer would fail (for the safety-critical warning). */
function isFailAnswer(q: InspectionQuestion, a: AnswerState | undefined): boolean {
  if (!a) return false;
  const s = a.valueString?.toUpperCase();
  switch (q.questionType) {
    case 'PASS_FAIL':
      return s === 'FAIL';
    case 'YES_NO':
      return s === 'NO';
    case 'NUMERIC': {
      if (a.valueNumeric == null) return false;
      const v = a.valueNumeric;
      if (q.numericMin != null && v < q.numericMin) return true;
      if (q.numericMax != null && v > q.numericMax) return true;
      return false;
    }
    default:
      return false;
  }
}

export function InspectionPerformPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [insp, setInsp] = useState<InspectionDetail | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [remarks, setRemarks] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const item = await getInspection(id);
      setInsp(item);
      setAnswers(seedAnswers(item));
      setRemarks(item.remarks ?? '');
      setConfirmName('');
      setDirty(false);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !insp) {
    return (
      <div>
        <PageHeader title="Perform inspection" />
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
        <PageHeader title="Perform inspection" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  // Completed inspections should be viewed on the detail page.
  if (insp.status === 'COMPLETED') {
    navigate(`/inspections/${insp.id}`, { replace: true });
    return null;
  }

  const sections = insp.templateVersion.sections;
  const currentSection = sections[currentSectionIdx];
  const allQuestions = sections.flatMap((s) => s.questions);
  const totalMandatory = allQuestions.filter((q) => q.isMandatory).length;
  const answeredMandatory = allQuestions.filter(
    (q) => q.isMandatory && isAnswered(q, answers[q.id]),
  ).length;
  const totalAnswered = allQuestions.filter((q) => isAnswered(q, answers[q.id]))
    .length;
  const anyPredictedFail = allQuestions.some((q) =>
    isFailAnswer(q, answers[q.id]),
  );
  const anySafetyFail = allQuestions.some(
    (q) => q.isSafetyCritical && isFailAnswer(q, answers[q.id]),
  );

  function setAnswer(
    qid: string,
    partial: Partial<AnswerState>,
  ) {
    setAnswers((cur) => {
      const previous: AnswerState = cur[qid] ?? { attachments: [] };
      return {
        ...cur,
        [qid]: {
          ...previous,
          ...partial,
        },
      };
    });
    setDirty(true);
    setBanner(null);
  }

  function buildResponsePayload(): SaveResponseInput[] {
    return allQuestions
      .filter((q) => {
        const a = answers[q.id];
        // Save answers that have any content — but include mandatory
        // questions even if unanswered so the server's mandatory check
        // has current data. We omit empty non-mandatory questions to
        // keep the payload small.
        if (q.isMandatory) return true;
        return !!a && isAnswered(q, a);
      })
      .map((q) => {
        const a = answers[q.id];
        return {
          questionId: q.id,
          valueString: a?.valueString ?? null,
          valueNumeric: a?.valueNumeric ?? null,
          valueDate: a?.valueDate ? new Date(a.valueDate).toISOString() : null,
          notes: a?.notes ?? null,
        };
      });
  }

  async function onSave() {
    if (!insp) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await saveInspectionProgress(insp.id, {
        responses: buildResponsePayload(),
        remarks,
      });
      setInsp(updated);
      setAnswers(seedAnswers(updated));
      setDirty(false);
      setBanner('Progress saved.');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!insp) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await submitInspection(insp.id, {
        responses: buildResponsePayload(),
        remarks,
        confirmationName: confirmName.trim(),
      });
      setShowConfirm(false);
      navigate(`/inspections/${updated.id}`, { replace: true });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPhoto(q: InspectionQuestion, file: File) {
    setBusy(true);
    setError(null);
    try {
      // Save the response row first so we have a response id to attach to.
      if (!insp) return;
      await saveInspectionProgress(insp.id, {
        responses: buildResponsePayload().concat(
          isAnswered(q, answers[q.id])
            ? []
            : [
                {
                  questionId: q.id,
                  valueString: answers[q.id]?.valueString ?? null,
                  valueNumeric: null,
                  valueDate: null,
                  notes: answers[q.id]?.notes ?? null,
                },
              ],
        ),
        remarks,
      });
      const detail = await getInspection(insp.id);
      const responseId = detail.responses.find((r) => r.questionId === q.id)?.id ?? null;
      const uploaded = await uploadInspectionAttachment(insp.id, file, {
        responseId,
      });
      const refreshed = await getInspection(insp.id);
      setInsp(refreshed);
      setAnswers((cur) => ({
        ...cur,
        [q.id]: {
          ...cur[q.id],
          attachments: [
            ...(cur[q.id]?.attachments ?? []),
            uploaded,
          ],
        },
      }));
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const progressPct = totalMandatory
    ? Math.round((answeredMandatory / totalMandatory) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={insp.equipment.name}
        description={
          <>
            <span className="font-mono">{insp.equipment.equipmentCode}</span>{' '}
            · {insp.equipment.equipmentType.name} ·{' '}
            {insp.templateVersion.template.name} (v{insp.templateVersion.versionNumber})
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate('/inspections')}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              disabled={!dirty || busy}
              onClick={onSave}
            >
              {busy ? 'Saving…' : dirty ? 'Save progress' : 'Saved'}
            </Button>
            <Button
              disabled={busy || answeredMandatory < totalMandatory}
              onClick={() => setShowConfirm(true)}
            >
              Submit inspection
            </Button>
          </>
        }
      />

      {/* Equipment context — location, department, serial etc. so the
          inspector has all the identifying info right next to the
          checklist, without having to open the equipment page. */}
      <EquipmentContextCard equipment={insp.equipment} unit={insp.unit} />

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            Progress: <strong>{answeredMandatory}</strong> / {totalMandatory} mandatory ·{' '}
            <span className="text-slate-500">
              {totalAnswered} / {allQuestions.length} total
            </span>
          </p>
          {anySafetyFail && (
            <Badge tone="red">Safety-critical failure — will be recorded</Badge>
          )}
          {!anySafetyFail && anyPredictedFail && (
            <Badge tone="amber">Some answers will fail</Badge>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
          <div
            className={`h-1.5 rounded-full transition-all ${
              anySafetyFail
                ? 'bg-red-500'
                : anyPredictedFail
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {banner && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {banner}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Section tabs on desktop, dropdown on mobile */}
      {sections.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {sections.map((s, i) => {
            const done = s.questions.every((q) =>
              !q.isMandatory ? true : isAnswered(q, answers[q.id]),
            );
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSectionIdx(i)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  i === currentSectionIdx
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {i + 1}. {s.title} {done ? '✓' : ''}
              </button>
            );
          })}
        </div>
      )}

      {currentSection && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Section {currentSectionIdx + 1} of {sections.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              {currentSection.title}
            </h2>
            {currentSection.description && (
              <p className="mt-1 text-sm text-slate-600">
                {currentSection.description}
              </p>
            )}
          </header>

          <div className="divide-y divide-slate-200">
            {currentSection.questions.map((q) => (
              <QuestionInput
                key={q.id}
                q={q}
                answer={answers[q.id]}
                onChange={(partial) => setAnswer(q.id, partial)}
                onPhoto={(f) => onUploadPhoto(q, f)}
                busy={busy}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section nav */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          disabled={currentSectionIdx === 0}
          onClick={() => setCurrentSectionIdx((i) => Math.max(0, i - 1))}
        >
          ← Previous section
        </Button>
        <p className="text-xs text-slate-500">
          Section {currentSectionIdx + 1} of {sections.length}
        </p>
        <Button
          variant={
            currentSectionIdx === sections.length - 1 ? 'secondary' : 'primary'
          }
          disabled={currentSectionIdx === sections.length - 1}
          onClick={() =>
            setCurrentSectionIdx((i) => Math.min(sections.length - 1, i + 1))
          }
        >
          Next section →
        </Button>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <TextArea
          label="Overall remarks (optional)"
          rows={3}
          value={remarks}
          onChange={(e) => {
            setRemarks(e.target.value);
            setDirty(true);
          }}
        />
      </section>

      {/* Spacer so the sticky bar doesn't cover the last field */}
      <div className="h-20" />

      {/* Sticky action bar so Save/Submit are always reachable on
          long inspections, especially on mobile. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_10px_-4px_rgba(15,23,42,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            <strong>{answeredMandatory}</strong> / {totalMandatory} mandatory
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!dirty || busy}
              onClick={onSave}
            >
              {busy ? 'Saving…' : dirty ? 'Save progress' : 'Saved'}
            </Button>
            <Button
              disabled={busy || answeredMandatory < totalMandatory}
              onClick={() => setShowConfirm(true)}
            >
              Submit inspection
            </Button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={onSubmit}
        confirmName={confirmName}
        setConfirmName={setConfirmName}
        anySafetyFail={anySafetyFail}
        anyPredictedFail={anyPredictedFail}
        busy={busy}
      />
    </div>
  );
}

// =============================================================================
// Equipment context card
// =============================================================================

function EquipmentContextCard({
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
    ['Location', locationParts || '—'],
    ['Exact location', equipment.exactLocation ?? '—'],
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
  ];

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Equipment
          </p>
          <p className="text-base font-semibold text-slate-900">
            {equipment.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone="blue">{equipment.equipmentType.name}</Badge>
          <Badge tone="slate">{unit.code}</Badge>
          {!equipment.isActive && <Badge tone="slate">Inactive</Badge>}
          {equipment.status === 'UNDER_MAINTENANCE' && (
            <Badge tone="amber">Under maintenance</Badge>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// =============================================================================
// Question input renderer
// =============================================================================

function QuestionInput({
  q,
  answer,
  onChange,
  onPhoto,
  busy,
}: {
  q: InspectionQuestion;
  answer: AnswerState | undefined;
  onChange: (partial: Partial<AnswerState>) => void;
  onPhoto: (file: File) => void | Promise<void>;
  busy: boolean;
}) {
  const isFail = isFailAnswer(q, answer);
  return (
    <div
      className={`px-4 py-4 ${
        isFail && q.isSafetyCritical
          ? 'bg-red-50/60'
          : isFail
            ? 'bg-amber-50/60'
            : ''
      }`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{q.text}</p>
          {q.helpText && (
            <p className="mt-1 text-xs text-slate-500">{q.helpText}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {q.isMandatory && <Badge tone="slate">Mandatory</Badge>}
            {q.isSafetyCritical && <Badge tone="red">Safety-critical</Badge>}
            {q.requiresCorrectiveActionOnFail && (
              <Badge tone="amber">Auto CA on fail</Badge>
            )}
          </div>
        </div>
        {isAnswered(q, answer) && !isFail && (
          <Badge tone="green">Answered</Badge>
        )}
        {isFail && (
          <Badge tone={q.isSafetyCritical ? 'red' : 'amber'}>
            Fail{q.isSafetyCritical ? ' · safety-critical' : ''}
          </Badge>
        )}
      </div>

      <AnswerControl q={q} answer={answer} onChange={onChange} onPhoto={onPhoto} busy={busy} />

      <div className="mt-3">
        <TextArea
          label="Notes"
          rows={2}
          value={answer?.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value || null })}
        />
      </div>
    </div>
  );
}

function AnswerControl({
  q,
  answer,
  onChange,
  onPhoto,
  busy,
}: {
  q: InspectionQuestion;
  answer: AnswerState | undefined;
  onChange: (partial: Partial<AnswerState>) => void;
  onPhoto: (file: File) => void | Promise<void>;
  busy: boolean;
}) {
  const t: QuestionType = q.questionType;
  if (t === 'PASS_FAIL') return <PillGroup value={answer?.valueString ?? null} options={['PASS', 'FAIL', 'NA']} labels={{ PASS: 'Pass', FAIL: 'Fail', NA: 'N/A' }} onChange={(v) => onChange({ valueString: v })} />;
  if (t === 'YES_NO') return <PillGroup value={answer?.valueString ?? null} options={['YES', 'NO', 'NA']} labels={{ YES: 'Yes', NO: 'No', NA: 'N/A' }} onChange={(v) => onChange({ valueString: v })} />;
  if (t === 'NUMERIC') {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="any"
          value={answer?.valueNumeric ?? ''}
          onChange={(e) =>
            onChange({
              valueNumeric: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="max-w-[10rem]"
        />
        {q.numericUnit && (
          <span className="text-sm text-slate-600">{q.numericUnit}</span>
        )}
        {(q.numericMin != null || q.numericMax != null) && (
          <span className="text-xs text-slate-500">
            (range {q.numericMin ?? '—'} to {q.numericMax ?? '—'})
          </span>
        )}
      </div>
    );
  }
  if (t === 'DROPDOWN') {
    let opts: string[] = [];
    try {
      opts = JSON.parse(q.optionsJson || '[]');
    } catch {
      opts = [];
    }
    return (
      <select
        value={answer?.valueString ?? ''}
        onChange={(e) => onChange({ valueString: e.target.value })}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:max-w-md"
      >
        <option value="">Select an option…</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (t === 'DATE') {
    return (
      <input
        type="date"
        value={answer?.valueDate ?? ''}
        onChange={(e) => onChange({ valueDate: e.target.value || null })}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    );
  }
  if (t === 'TEXT') {
    return (
      <Input
        value={answer?.valueString ?? ''}
        onChange={(e) => onChange({ valueString: e.target.value })}
      />
    );
  }
  if (t === 'REMARKS') {
    return (
      <TextArea
        rows={3}
        value={answer?.valueString ?? ''}
        onChange={(e) => onChange({ valueString: e.target.value })}
      />
    );
  }
  if (t === 'PHOTO') {
    return <PhotoInput answer={answer} onPhoto={onPhoto} busy={busy} />;
  }
  return null;
}

function PillGroup({
  value,
  options,
  labels,
  onChange,
}: {
  value: string | null;
  options: string[];
  labels: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        const tone =
          opt === 'FAIL' || opt === 'NO'
            ? selected
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
            : opt === 'PASS' || opt === 'YES'
              ? selected
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
              : selected
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100';
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`min-w-[6rem] rounded-md border px-4 py-2 text-sm font-semibold shadow-sm ${tone}`}
          >
            {labels[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

function PhotoInput({
  answer,
  onPhoto,
  busy,
}: {
  answer: AnswerState | undefined;
  onPhoto: (file: File) => void | Promise<void>;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(answer?.attachments ?? []).map((a) => (
          <a
            key={a.id}
            href={inspectionAttachmentUrl(a.id)}
            target="_blank"
            rel="noopener"
            className="block h-24 w-24 overflow-hidden rounded border border-slate-300 bg-white"
            title={a.originalName}
          >
            <img
              src={inspectionAttachmentUrl(a.id)}
              alt={a.caption ?? a.originalName}
              className="h-full w-full object-cover"
            />
          </a>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : '+ Add photo'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              void onPhoto(f);
              // reset so re-selecting the same file re-triggers change
              if (inputRef.current) inputRef.current.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  confirmName,
  setConfirmName,
  anySafetyFail,
  anyPredictedFail,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmName: string;
  setConfirmName: (v: string) => void;
  anySafetyFail: boolean;
  anyPredictedFail: boolean;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit inspection?"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={anySafetyFail ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy || !confirmName.trim()}
          >
            {busy
              ? 'Submitting…'
              : anySafetyFail
                ? 'Submit as FAILED (safety-critical)'
                : anyPredictedFail
                  ? 'Submit as FAILED'
                  : 'Submit as PASSED'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Once submitted, the inspection record <strong>cannot be edited</strong>.
      </p>
      {anySafetyFail && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Safety-critical failure will be recorded.</p>
          <p className="mt-1 text-xs">
            The equipment will be flagged non-compliant. A supervisor will be
            notified. Corrective actions may be raised automatically.
          </p>
        </div>
      )}
      {!anySafetyFail && anyPredictedFail && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The overall result will be marked <strong>FAIL</strong>.
        </div>
      )}
      <div className="mt-4">
        <Input
          label="Type your name to confirm"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder="e.g. Field Inspector"
        />
      </div>
    </Modal>
  );
}

// Silence "declared but never read" warning on the response type import
export type _ = InspectionResponseRow;
