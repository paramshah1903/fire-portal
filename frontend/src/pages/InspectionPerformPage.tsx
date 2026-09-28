import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toApiError } from '../lib/api';
import {
  deleteInspectionAttachment,
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
  // Pre-fill any RADIO / DROPDOWN question that has a default and no
  // existing answer yet — a convenience for inspectors so the common
  // answer is already selected.
  for (const section of insp.templateVersion.sections) {
    for (const q of section.questions) {
      if (map[q.id]) continue;
      if (
        (q.questionType === 'RADIO' || q.questionType === 'DROPDOWN') &&
        q.defaultOptionValue
      ) {
        map[q.id] = {
          valueString: q.defaultOptionValue,
          valueNumeric: null,
          valueDate: null,
          notes: null,
          attachments: [],
        };
      }
    }
  }
  return map;
}

function isAnswered(q: InspectionQuestion, a: AnswerState | undefined): boolean {
  if (!a) return false;
  switch (q.questionType) {
    case 'PASS_FAIL':
    case 'YES_NO':
    case 'DROPDOWN':
    case 'RADIO':
    case 'TEXT':
    case 'REMARKS':
      return !!a.valueString && a.valueString.trim().length > 0;
    case 'CHECKBOX': {
      if (!a.valueString) return false;
      try {
        const arr = JSON.parse(a.valueString);
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    }
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
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

  async function onDeletePhoto(q: InspectionQuestion, attachmentId: string) {
    if (!insp) return;
    if (!confirm('Remove this photo? You can capture a new one.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteInspectionAttachment(attachmentId);
      const refreshed = await getInspection(insp.id);
      setInsp(refreshed);
      setAnswers((cur) => ({
        ...cur,
        [q.id]: {
          ...(cur[q.id] ?? { attachments: [] }),
          attachments: (cur[q.id]?.attachments ?? []).filter(
            (a) => a.id !== attachmentId,
          ),
        },
      }));
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

      <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            Progress: <strong>{answeredMandatory}</strong> / {totalMandatory} mandatory ·{' '}
            <span className="text-slate-500 dark:text-slate-400">
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
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {i + 1}. {s.title} {done ? '✓' : ''}
              </button>
            );
          })}
        </div>
      )}

      {currentSection && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <header className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Section {currentSectionIdx + 1} of {sections.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {currentSection.title}
            </h2>
            {currentSection.description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {currentSection.description}
              </p>
            )}
          </header>

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {currentSection.questions.map((q) => (
              <QuestionInput
                key={q.id}
                q={q}
                answer={answers[q.id]}
                onChange={(partial) => setAnswer(q.id, partial)}
                onPhoto={(f) => onUploadPhoto(q, f)}
                onDeletePhoto={(id) => onDeletePhoto(q, id)}
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
        <p className="text-xs text-slate-500 dark:text-slate-400">
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

      <section className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/95 px-4 py-3 shadow-[0_-4px_10px_-4px_rgba(15,23,42,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">
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
    <section className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Equipment
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
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

// =============================================================================
// Question input renderer
// =============================================================================

function QuestionInput({
  q,
  answer,
  onChange,
  onPhoto,
  onDeletePhoto,
  busy,
}: {
  q: InspectionQuestion;
  answer: AnswerState | undefined;
  onChange: (partial: Partial<AnswerState>) => void;
  onPhoto: (file: File) => void | Promise<void>;
  onDeletePhoto: (attachmentId: string) => void | Promise<void>;
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
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{q.text}</p>
          {q.helpText && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{q.helpText}</p>
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

      <AnswerControl
        q={q}
        answer={answer}
        onChange={onChange}
        onPhoto={onPhoto}
        onDeletePhoto={onDeletePhoto}
        busy={busy}
      />
    </div>
  );
}

function AnswerControl({
  q,
  answer,
  onChange,
  onPhoto,
  onDeletePhoto,
  busy,
}: {
  q: InspectionQuestion;
  answer: AnswerState | undefined;
  onChange: (partial: Partial<AnswerState>) => void;
  onPhoto: (file: File) => void | Promise<void>;
  onDeletePhoto: (attachmentId: string) => void | Promise<void>;
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
          <span className="text-sm text-slate-600 dark:text-slate-400">{q.numericUnit}</span>
        )}
        {(q.numericMin != null || q.numericMax != null) && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
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
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:max-w-md"
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
  if (t === 'RADIO') {
    let opts: string[] = [];
    try {
      opts = JSON.parse(q.optionsJson || '[]');
    } catch {
      opts = [];
    }
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((opt) => {
          const selected = answer?.valueString === opt;
          const tone = selected
            ? 'bg-brand-600 text-white border-brand-600'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700';
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ valueString: opt })}
              className={`min-w-[6rem] rounded-md border px-4 py-2 text-sm font-semibold shadow-sm ${tone}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  if (t === 'CHECKBOX') {
    let opts: string[] = [];
    try {
      opts = JSON.parse(q.optionsJson || '[]');
    } catch {
      opts = [];
    }
    let selected: string[] = [];
    try {
      const parsed = JSON.parse(answer?.valueString || '[]');
      if (Array.isArray(parsed)) selected = parsed.filter((v) => typeof v === 'string');
    } catch {
      selected = [];
    }
    function toggle(opt: string) {
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      onChange({ valueString: JSON.stringify(next) });
    }
    return (
      <div className="flex flex-col gap-2">
        {opts.map((opt) => (
          <label
            key={opt}
            className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4"
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    );
  }
  if (t === 'DATE') {
    return (
      <input
        type="date"
        value={answer?.valueDate ?? ''}
        onChange={(e) => onChange({ valueDate: e.target.value || null })}
        className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
    return (
      <PhotoInput
        answer={answer}
        onPhoto={onPhoto}
        onDeletePhoto={onDeletePhoto}
        busy={busy}
      />
    );
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
              : 'bg-white dark:bg-slate-900 text-red-700 border-red-300 hover:bg-red-50'
            : opt === 'PASS' || opt === 'YES'
              ? selected
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-900 text-emerald-700 border-emerald-300 hover:bg-emerald-50'
              : selected
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800';
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
  onDeletePhoto,
  busy,
}: {
  answer: AnswerState | undefined;
  onPhoto: (file: File) => void | Promise<void>;
  onDeletePhoto: (attachmentId: string) => void | Promise<void>;
  busy: boolean;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(answer?.attachments ?? []).map((a) => (
          <div key={a.id} className="relative h-24 w-24">
            <a
              href={inspectionAttachmentUrl(a.id)}
              target="_blank"
              rel="noopener"
              className="block h-24 w-24 overflow-hidden rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              title={a.originalName}
            >
              <img
                src={inspectionAttachmentUrl(a.id)}
                alt={a.caption ?? a.originalName}
                className="h-full w-full object-cover"
              />
            </a>
            {/* Remove button — floats at top-right of the thumbnail.
                Deletes the attachment from the pending inspection. */}
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDeletePhoto(a.id)}
              aria-label="Remove photo"
              title="Remove photo"
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 disabled:opacity-50"
            >
              <span className="text-sm leading-none">×</span>
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => setCameraOpen(true)}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          <span className="text-lg" aria-hidden>
            📷
          </span>
          <span>{busy ? 'Uploading…' : 'Capture'}</span>
        </button>
      </div>
      {cameraOpen && (
        <CameraCaptureModal
          onCapture={async (file) => {
            setCameraOpen(false);
            await onPhoto(file);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Live camera capture modal. Uses navigator.mediaDevices.getUserMedia
 * (back camera preferred) so the user MUST take a fresh photo — there
 * is no path to the gallery or the local filesystem.
 *
 * Flow: preview → Capture → freeze frame → Retake | Use photo.
 * Cleanup: on unmount all video tracks are stopped so the camera
 * indicator turns off.
 */
function CameraCaptureModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => Promise<void> | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(
            'This device does not have a camera or the browser does not support live camera capture. Try again on a phone.',
          );
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
            : err instanceof Error
              ? err.message
              : 'Could not start the camera.';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setStarting(false);
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCaptured({ blob, url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.9,
    );
  }

  function retake() {
    if (captured) URL.revokeObjectURL(captured.url);
    setCaptured(null);
  }

  async function useIt() {
    if (!captured) return;
    setBusy(true);
    try {
      const file = new File(
        [captured.blob],
        `photo-${Date.now()}.jpg`,
        { type: 'image/jpeg' },
      );
      await onCapture(file);
      URL.revokeObjectURL(captured.url);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (captured) URL.revokeObjectURL(captured.url);
    onClose();
  }

  return (
    <Modal
      open={true}
      title="Take photo"
      onClose={close}
      size="lg"
      footer={
        captured ? (
          <>
            <Button variant="secondary" onClick={retake} disabled={busy}>
              Retake
            </Button>
            <Button onClick={useIt} disabled={busy}>
              {busy ? 'Uploading…' : 'Use photo'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={capture} disabled={!!error || starting}>
              Capture
            </Button>
          </>
        )
      }
    >
      {error ? (
        <ErrorBanner message={error} />
      ) : captured ? (
        <img
          src={captured.url}
          alt="Captured preview"
          className="w-full rounded-md"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-md bg-slate-900"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {starting
              ? 'Starting camera…'
              : 'Position the equipment in view, then tap Capture.'}
          </p>
        </>
      )}
    </Modal>
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
      <p className="text-sm text-slate-700 dark:text-slate-300">
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
