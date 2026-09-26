import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  getVersion,
  publishDraftVersion,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  updateDraftVersion,
  type ChecklistQuestion,
  type ChecklistSection,
  type ChecklistVersion,
  type QuestionType,
} from '../lib/apiChecklists';
import { PERMS } from '../lib/permissions';
import {
  Badge,
  Button,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  TextArea,
} from '../components/ui';

function emptyQuestion(): ChecklistQuestion {
  return {
    text: '',
    helpText: null,
    questionType: 'PASS_FAIL',
    isMandatory: true,
    isSafetyCritical: false,
    requiresCorrectiveActionOnFail: false,
    optionsJson: null,
    numericMin: null,
    numericMax: null,
    numericUnit: null,
    isActive: true,
  };
}

function emptySection(): ChecklistSection {
  return {
    title: 'New section',
    description: null,
    questions: [emptyQuestion()],
  };
}

interface DraftState {
  sections: ChecklistSection[];
}

/**
 * Convert the API-shaped version into an editable form and back.
 */
function toDraftState(version: ChecklistVersion): DraftState {
  return {
    sections: version.sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      questions: s.questions.map((q) => ({ ...q })),
    })),
  };
}

export function ChecklistVersionEditorPage() {
  const { templateId, versionId } = useParams<{
    templateId: string;
    versionId: string;
  }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.CHECKLIST_MANAGE);

  const [version, setVersion] = useState<ChecklistVersion | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!versionId) return;
    setError(null);
    setBanner(null);
    try {
      const v = await getVersion(versionId);
      setVersion(v);
      setDraft(toDraftState(v));
      setDirty(false);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, [versionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const readOnly = !version || version.status !== 'DRAFT' || !canManage;

  function mutateDraft(fn: (d: DraftState) => DraftState) {
    if (readOnly) return;
    setDraft((current) => (current ? fn(current) : current));
    setDirty(true);
    setBanner(null);
  }

  async function onSave() {
    if (!draft || !versionId) return;
    setBusy(true);
    setError(null);
    try {
      const v = await updateDraftVersion(versionId, draft.sections);
      setVersion(v);
      setDraft(toDraftState(v));
      setDirty(false);
      setBanner('Draft saved.');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!versionId || !version) return;
    if (
      !window.confirm(
        `Publish v${version.versionNumber}?\n\nThe currently published version (if any) will be archived. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (dirty) {
        await updateDraftVersion(versionId, draft!.sections);
      }
      await publishDraftVersion(versionId);
      navigate(`/checklist-templates/${templateId}`);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !version) {
    return (
      <div>
        <PageHeader title="Version editor" />
        <ErrorBanner message={error} />
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => navigate(`/checklist-templates/${templateId}`)}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }
  if (!version || !draft) {
    return (
      <div>
        <PageHeader title="Version editor" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const totalQuestions = draft.sections.reduce(
    (n, s) => n + s.questions.length,
    0,
  );

  return (
    <div>
      <PageHeader
        title={`${version.template?.name ?? 'Checklist'} — v${version.versionNumber}`}
        description={
          <>
            <Badge
              tone={
                version.status === 'DRAFT'
                  ? 'amber'
                  : version.status === 'PUBLISHED'
                    ? 'green'
                    : 'slate'
              }
            >
              {version.status}
            </Badge>
            {version.isCurrent && (
              <span className="ml-2">
                <Badge tone="green">Current</Badge>
              </span>
            )}
            {readOnly && (
              <span className="ml-2 text-xs text-slate-500">
                (read-only — create a new draft to change a published template)
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate(`/checklist-templates/${templateId}`)}
            >
              Back
            </Button>
            {!readOnly && (
              <>
                <Button
                  variant="secondary"
                  disabled={!dirty || busy}
                  onClick={onSave}
                >
                  {busy ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
                </Button>
                <Button
                  disabled={busy || totalQuestions === 0}
                  onClick={onPublish}
                >
                  {busy ? 'Publishing…' : 'Publish version'}
                </Button>
              </>
            )}
          </>
        }
      />

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
      {dirty && !readOnly && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You have unsaved changes.
        </div>
      )}

      <div className="space-y-4">
        {draft.sections.map((section, si) => (
          <SectionEditor
            key={section.id ?? `s-${si}`}
            section={section}
            index={si}
            total={draft.sections.length}
            readOnly={readOnly}
            onChange={(fn) =>
              mutateDraft((d) => ({
                ...d,
                sections: d.sections.map((s, i) => (i === si ? fn(s) : s)),
              }))
            }
            onMove={(dir) =>
              mutateDraft((d) => {
                const next = [...d.sections];
                const swap = si + dir;
                if (swap < 0 || swap >= next.length) return d;
                [next[si], next[swap]] = [next[swap], next[si]];
                return { ...d, sections: next };
              })
            }
            onRemove={() =>
              mutateDraft((d) => ({
                ...d,
                sections: d.sections.filter((_, i) => i !== si),
              }))
            }
          />
        ))}

        {!readOnly && (
          <div>
            <Button
              variant="secondary"
              onClick={() =>
                mutateDraft((d) => ({
                  ...d,
                  sections: [...d.sections, emptySection()],
                }))
              }
            >
              Add section
            </Button>
          </div>
        )}
      </div>

      {!readOnly && (
        <>
          {/* Spacer so the sticky bar doesn't cover the last button */}
          <div className="h-20" />

          {/* Sticky action bar so Save/Publish are reachable while
              scrolled deep into a long template. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_10px_-4px_rgba(15,23,42,0.15)] backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                {totalQuestions} question{totalQuestions === 1 ? '' : 's'} across{' '}
                {draft.sections.length} section
                {draft.sections.length === 1 ? '' : 's'}
                {dirty && ' · unsaved changes'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={!dirty || busy}
                  onClick={onSave}
                >
                  {busy ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
                </Button>
                <Button
                  disabled={busy || totalQuestions === 0}
                  onClick={onPublish}
                >
                  Publish version
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Section editor
// ============================================================================

function SectionEditor({
  section,
  index,
  total,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: {
  section: ChecklistSection;
  index: number;
  total: number;
  readOnly: boolean;
  onChange: (fn: (s: ChecklistSection) => ChecklistSection) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Section {index + 1}
          </p>
          <Input
            aria-label="Section title"
            disabled={readOnly}
            value={section.title}
            onChange={(e) => onChange((s) => ({ ...s, title: e.target.value }))}
            className="mt-1 font-medium"
          />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              type="button"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              ↓
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={onRemove}
            >
              Remove
            </Button>
          </div>
        )}
      </header>
      <div className="px-4 py-3">
        <TextArea
          label="Section description (optional)"
          disabled={readOnly}
          rows={2}
          value={section.description ?? ''}
          onChange={(e) =>
            onChange((s) => ({ ...s, description: e.target.value || null }))
          }
        />
        <div className="mt-4 space-y-3">
          {section.questions.map((q, qi) => (
            <QuestionEditor
              key={q.id ?? `q-${qi}`}
              question={q}
              index={qi}
              total={section.questions.length}
              readOnly={readOnly}
              onChange={(fn) =>
                onChange((s) => ({
                  ...s,
                  questions: s.questions.map((qq, i) =>
                    i === qi ? fn(qq) : qq,
                  ),
                }))
              }
              onMove={(dir) =>
                onChange((s) => {
                  const next = [...s.questions];
                  const swap = qi + dir;
                  if (swap < 0 || swap >= next.length) return s;
                  [next[qi], next[swap]] = [next[swap], next[qi]];
                  return { ...s, questions: next };
                })
              }
              onRemove={() =>
                onChange((s) => ({
                  ...s,
                  questions: s.questions.filter((_, i) => i !== qi),
                }))
              }
            />
          ))}
        </div>
        {!readOnly && (
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() =>
                onChange((s) => ({
                  ...s,
                  questions: [...s.questions, emptyQuestion()],
                }))
              }
            >
              Add question
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Question editor
// ============================================================================

function QuestionEditor({
  question,
  index,
  total,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: {
  question: ChecklistQuestion;
  index: number;
  total: number;
  readOnly: boolean;
  onChange: (fn: (q: ChecklistQuestion) => ChecklistQuestion) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Question {index + 1}
        </p>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              type="button"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              ↓
            </Button>
            <Button variant="secondary" type="button" onClick={onRemove}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Question text"
            disabled={readOnly}
            value={question.text}
            onChange={(e) =>
              onChange((q) => ({ ...q, text: e.target.value }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label="Help text (optional)"
            disabled={readOnly}
            rows={2}
            value={question.helpText ?? ''}
            onChange={(e) =>
              onChange((q) => ({ ...q, helpText: e.target.value || null }))
            }
          />
        </div>
        <Select
          label="Question type"
          disabled={readOnly}
          value={question.questionType}
          onChange={(e) =>
            onChange((q) => ({
              ...q,
              questionType: e.target.value as QuestionType,
              // Reset per-type fields on type change.
              optionsJson: null,
              numericMin: null,
              numericMax: null,
              numericUnit: null,
            }))
          }
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>

        {/* Per-type extras */}
        {question.questionType === 'DROPDOWN' && (
          <div className="sm:col-span-2">
            <DropdownOptionsInput
              value={question.optionsJson}
              disabled={readOnly}
              onChange={(nextJson) =>
                onChange((q) => ({ ...q, optionsJson: nextJson }))
              }
            />
          </div>
        )}
        {question.questionType === 'NUMERIC' && (
          <>
            <Input
              label="Min"
              type="number"
              disabled={readOnly}
              value={question.numericMin ?? ''}
              onChange={(e) =>
                onChange((q) => ({
                  ...q,
                  numericMin:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <Input
              label="Max"
              type="number"
              disabled={readOnly}
              value={question.numericMax ?? ''}
              onChange={(e) =>
                onChange((q) => ({
                  ...q,
                  numericMax:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <Input
              label="Unit"
              disabled={readOnly}
              value={question.numericUnit ?? ''}
              onChange={(e) =>
                onChange((q) => ({
                  ...q,
                  numericUnit: e.target.value || null,
                }))
              }
              hint="e.g. bar, kg, °C"
            />
          </>
        )}

        <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
          <Toggle
            label="Mandatory"
            disabled={readOnly}
            checked={question.isMandatory}
            onChange={(v) => onChange((q) => ({ ...q, isMandatory: v }))}
          />
          <Toggle
            label="Safety-critical"
            disabled={readOnly}
            checked={question.isSafetyCritical}
            onChange={(v) => onChange((q) => ({ ...q, isSafetyCritical: v }))}
            hint="A failed answer marks the whole inspection as non-compliant."
          />
          <Toggle
            label="Auto-create corrective action on failure"
            disabled={readOnly}
            checked={question.requiresCorrectiveActionOnFail}
            onChange={(v) =>
              onChange((q) => ({ ...q, requiresCorrectiveActionOnFail: v }))
            }
          />
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 text-sm text-slate-700 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        className="mt-1"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <p>{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </label>
  );
}

function optionsJsonToLines(json: string | null): string {
  if (!json) return '';
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed))
      return parsed.filter((s) => typeof s === 'string').join('\n');
  } catch {
    // fall through
  }
  return '';
}

function optionsLinesToJson(text: string): string | null {
  const parts = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? JSON.stringify(parts) : null;
}

/**
 * Self-contained textarea for the "Dropdown options" list. Holds the
 * raw text in local state so a keystroke that would otherwise round-
 * trip through JSON (and lose trailing punctuation, whitespace, blank
 * lines, etc.) doesn't clobber what the user typed. Only re-syncs
 * from the outer JSON when it actually differs from the last value
 * we serialised — that handles the initial mount and any external
 * update (e.g. loading a template from the server).
 *
 * Users can put options with commas ("Approved, with conditions")
 * because we split strictly on newlines.
 */
function DropdownOptionsInput({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled?: boolean;
  onChange: (nextJson: string | null) => void;
}) {
  const [text, setText] = useState<string>(() => optionsJsonToLines(value));
  const lastEmittedRef = useRef<string | null>(optionsLinesToJson(text));

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setText(optionsJsonToLines(value));
      lastEmittedRef.current = value;
    }
  }, [value]);

  function handleChange(next: string) {
    setText(next);
    const json = optionsLinesToJson(next);
    lastEmittedRef.current = json;
    onChange(json);
  }

  return (
    <div>
      <TextArea
        label="Dropdown options"
        rows={4}
        disabled={disabled}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
      <p className="mt-1 text-xs text-slate-500">
        One option per line. Blank lines are ignored. Options may contain commas.
      </p>
    </div>
  );
}
