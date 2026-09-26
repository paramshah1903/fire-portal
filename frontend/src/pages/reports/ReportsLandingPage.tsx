import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';

interface ReportCard {
  to: string;
  title: string;
  description: string;
}

const CARDS: ReportCard[] = [
  {
    to: '/reports/compliance',
    title: 'Compliance report',
    description:
      'For a given month, per-equipment: was the inspection completed on time? passed?',
  },
  {
    to: '/reports/unit-compliance',
    title: 'Unit compliance',
    description:
      'Roll-up of compliance figures per unit — completion rate, pass rate.',
  },
  {
    to: '/reports/equipment-history',
    title: 'Equipment history',
    description:
      'Full inspection history for one equipment, including template versions used.',
  },
  {
    to: '/reports/equipment-inspection-log',
    title: 'Equipment inspection log',
    description:
      'For one equipment: every question × every inspection, plus who filled it. Ideal for audits.',
  },
  {
    to: '/reports/failed-equipment',
    title: 'Failed equipment',
    description:
      'Currently non-compliant equipment, with open corrective-action counts.',
  },
  {
    to: '/reports/corrective-actions',
    title: 'Corrective actions',
    description:
      'CA list with priority, status, days-open, and average time-to-close.',
  },
];

export function ReportsLandingPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Every report supports on-screen review plus CSV, Excel, and print (browser Save-as-PDF) exports."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 hover:bg-brand-50/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600">
              Report
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              {c.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
