import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';

interface ReportCard {
  to: string;
  title: string;
}

const CARDS: ReportCard[] = [
  { to: '/reports/compliance',              title: 'Compliance report' },
  { to: '/reports/unit-compliance',         title: 'Unit compliance' },
  { to: '/reports/equipment-history',       title: 'Equipment history' },
  { to: '/reports/equipment-inspection-log', title: 'Equipment inspection log' },
  { to: '/reports/by-equipment-type',       title: 'Inspections by equipment type' },
  { to: '/reports/failed-equipment',        title: 'Failed equipment' },
  { to: '/reports/corrective-actions',      title: 'Corrective actions' },
];

export function ReportsLandingPage() {
  return (
    <div>
      <PageHeader title="Reports" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-brand-300 hover:bg-brand-50/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600">
              Report
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
              {c.title}
            </h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
