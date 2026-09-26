import type { ReactNode } from 'react';
import { Badge } from '../../components/ui';

export function ReportSummary({ items }: { items: SummaryItem[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-sm">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5"
        >
          <Badge tone={it.tone ?? 'slate'}>{it.value}</Badge>
          <span className="text-slate-700 dark:text-slate-300">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export interface SummaryItem {
  label: string;
  value: number | string;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue';
}

export function ExportBar({
  csvUrl,
  xlsxUrl,
}: {
  csvUrl: string;
  xlsxUrl: string;
}) {
  return (
    <div className="print-hide flex flex-wrap gap-2">
      <a
        href={csvUrl}
        className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Export CSV
      </a>
      <a
        href={xlsxUrl}
        className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Export Excel
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Print / PDF
      </button>
    </div>
  );
}

export function ReportTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                scope="col"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{children}</tbody>
      </table>
    </div>
  );
}
