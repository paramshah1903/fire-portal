import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toApiError } from '../lib/api';
import {
  listPendingApprovals,
  type InspectionListItem,
} from '../lib/apiInspections';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from '../components/ui';

/**
 * Notification centre for inspection approvers. Lists every
 * PENDING_APPROVAL inspection where the current user is on the
 * template's approver list (or is a Super Admin).
 */
export function ApprovalsPage() {
  const [rows, setRows] = useState<InspectionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const items = await listPendingApprovals();
      setRows(items);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={
          rows === null
            ? undefined
            : rows.length === 0
              ? 'No inspections are waiting for you.'
              : `${rows.length} inspection${rows.length === 1 ? '' : 's'} waiting for your review.`
        }
        actions={
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          description="No pending approvals for you right now."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Period</Th>
                <Th>Equipment</Th>
                <Th>Template</Th>
                <Th>Inspector</Th>
                <Th>Submitted</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Td className="font-mono text-xs">{r.periodKey}</Td>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.equipment.equipmentCode}
                    </span>{' '}
                    {r.equipment.name}
                    <div className="mt-0.5">
                      <Badge tone="slate">{r.equipment.equipmentType.name}</Badge>{' '}
                      <Badge tone="slate">{r.unit.code}</Badge>
                    </div>
                  </Td>
                  <Td className="text-xs text-slate-600 dark:text-slate-400">
                    {r.templateVersion.template.name} (v
                    {r.templateVersion.versionNumber})
                  </Td>
                  <Td>{r.inspector.fullName}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {new Date(r.updatedAt).toLocaleString()}
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/inspections/${r.id}`}
                      className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-600"
                    >
                      Review
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
