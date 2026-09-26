import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toApiError } from '../lib/api';
import {
  commitImport,
  previewImport,
  templateDownloadUrl,
  type ImportPreview,
  type ImportRow,
} from '../lib/apiEquipment';
import { Badge, Button, ErrorBanner, PageHeader } from '../components/ui';

type Step = 'upload' | 'preview' | 'done';

export function EquipmentImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
  } | null>(null);

  async function onPreview() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const res = await previewImport(file);
      setPreview(res);
      setStep('preview');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      const res = await commitImport(preview.rows);
      setResult({ inserted: res.inserted, skipped: res.skipped });
      setStep('done');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep('upload');
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      <PageHeader
        title="Bulk import equipment"
        description="Upload a CSV or Excel file, review the parsed rows, then confirm to insert. Rows with errors are skipped."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate('/equipment')}
            >
              Back to equipment
            </Button>
            <a
              href={templateDownloadUrl()}
              className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Download template
            </a>
          </>
        }
      />

      <ol className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
        <StepBadge label="1. Upload" active={step === 'upload'} done={step !== 'upload'} />
        <StepBadge label="2. Preview" active={step === 'preview'} done={step === 'done'} />
        <StepBadge label="3. Result" active={step === 'done'} done={false} />
      </ol>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {step === 'upload' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">1. Choose file</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Accepted: CSV, XLS, XLSX. Max 5&nbsp;MB. The first row must be a
            header row using the column names from the template.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button onClick={onPreview} disabled={!file || busy}>
              {busy ? 'Analysing…' : 'Analyse file'}
            </Button>
          </div>
        </section>
      )}

      {step === 'preview' && preview && (
        <PreviewPanel
          preview={preview}
          onCommit={onCommit}
          onCancel={reset}
          busy={busy}
        />
      )}

      {step === 'done' && result && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import complete</h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            Inserted {result.inserted} equipment record
            {result.inserted === 1 ? '' : 's'}
            {result.skipped > 0 ? `, skipped ${result.skipped}` : ''}.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate('/equipment')}>Go to equipment list</Button>
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function StepBadge({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  const cls = active
    ? 'bg-brand-50 text-brand-800 border-brand-200'
    : done
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function PreviewPanel({
  preview,
  onCommit,
  onCancel,
  busy,
}: {
  preview: ImportPreview;
  onCommit: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const visible = showOnlyErrors
    ? preview.rows.filter((r) => r.errors.length > 0)
    : preview.rows;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <SummaryStat label="Total rows" value={preview.summary.total} tone="slate" />
          <SummaryStat label="Valid" value={preview.summary.valid} tone="green" />
          <SummaryStat label="Invalid" value={preview.summary.invalid} tone="red" />
          <SummaryStat
            label="Duplicates in file"
            value={preview.summary.duplicatesInFile}
            tone="amber"
          />
          <SummaryStat
            label="Duplicates in database"
            value={preview.summary.duplicatesInDb}
            tone="amber"
          />
        </div>
        {preview.summary.valid === 0 && (
          <p className="mt-3 text-sm text-red-700">
            No rows are eligible for import. Fix the errors and re-upload the file.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rows</h2>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={showOnlyErrors}
              onChange={(e) => setShowOnlyErrors(e.target.checked)}
            />
            Only show rows with errors
          </label>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>#</Th>
                <Th>Status</Th>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Unit</Th>
                <Th>Dept</Th>
                <Th>Errors</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {visible.map((r) => (
                <RowRow key={`${r.rowNumber}-${r.equipmentCode}`} row={r} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nothing to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Confirm import</p>
        <p className="mt-1">
          {preview.summary.valid} row{preview.summary.valid === 1 ? '' : 's'} will
          be inserted. Rows with errors will be skipped. Historical records are
          never modified.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            onClick={onCommit}
            disabled={preview.summary.valid === 0 || busy}
          >
            {busy
              ? 'Importing…'
              : `Import ${preview.summary.valid} row${preview.summary.valid === 1 ? '' : 's'}`}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'green' | 'red' | 'amber';
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge tone={tone}>{value}</Badge>
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

function RowRow({ row }: { row: ImportRow }) {
  const bad = row.errors.length > 0;
  return (
    <tr className={bad ? 'bg-red-50/50' : ''}>
      <Td className="text-xs text-slate-500 dark:text-slate-400">{row.rowNumber}</Td>
      <Td>
        {bad ? (
          <Badge tone="red">Skip</Badge>
        ) : (
          <Badge tone="green">Insert</Badge>
        )}
      </Td>
      <Td className="font-mono text-xs">{row.equipmentCode || '—'}</Td>
      <Td>{row.name || '—'}</Td>
      <Td className="font-mono text-xs">{row.equipmentTypeKey || '—'}</Td>
      <Td className="font-mono text-xs">{row.unitCode || '—'}</Td>
      <Td className="font-mono text-xs">{row.departmentCode || '—'}</Td>
      <Td className="text-xs text-red-700">
        {row.errors.length > 0 ? row.errors.join(' · ') : ''}
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>{children}</td>;
}
