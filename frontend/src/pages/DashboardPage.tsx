import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  fetchDashboard,
  type Dashboard,
  type DashboardUnitCompletionRow,
} from '../lib/apiDashboard';
import { listEquipmentTypes, type EquipmentType } from '../lib/apiEquipment';
import { listUnits, type Unit } from '../lib/apiUnits';
import { ROLES } from '../lib/permissions';
import {
  ErrorBanner,
  PageHeader,
  Select,
} from '../components/ui';
import {
  DateRangeFilter,
  defaultFromDate,
  defaultToDate,
} from '../components/DateRangeFilter';

// Palette tuned for print + colour-blindness.
const COLOURS = {
  completed: '#16a34a', // emerald-600
  inProgress: '#f59e0b', // amber-500
  due: '#94a3b8', // slate-400
  overdue: '#dc2626', // red-600
  critical: '#b91c1c',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#94a3b8',
} as const;

export function DashboardPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [fromDate, setFromDate] = useState<string>(defaultFromDate());
  const [toDate, setToDate] = useState<string>(defaultToDate());
  const [unitId, setUnitId] = useState<string>('');
  const [equipmentTypeId, setEquipmentTypeId] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => setUnits([]));
    listEquipmentTypes(true).then(setTypes).catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    setError(null);
    fetchDashboard({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      unitId: centralOrSuper ? unitId || undefined : undefined,
      equipmentTypeId: equipmentTypeId || undefined,
    })
      .then(setData)
      .catch((err) => setError(toApiError(err).message));
  }, [fromDate, toDate, unitId, equipmentTypeId, centralOrSuper]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          <>
            {user && (
              <>
                Welcome, {user.fullName}
                {data?.scope.unitScoped && (
                  <> — showing your unit only</>
                )}
              </>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={({ fromDate: f, toDate: t }) => {
            setFromDate(f);
            setToDate(t);
          }}
        />
        {centralOrSuper && (
          <Select
            label="Unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          label="Equipment type"
          value={equipmentTypeId}
          onChange={(e) => setEquipmentTypeId(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data === null ? (
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      ) : (
        <>
          <KpiGrid data={data} />
          <ChartsGrid data={data} />
        </>
      )}
    </div>
  );
}

// ============================================================================
// KPI grid
// ============================================================================

function KpiGrid({ data }: { data: Dashboard }) {
  const k = data.kpis;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="Total equipment" value={k.totalEquipment} />
      <Kpi label="Active equipment" value={k.activeEquipment} tone="green" />
      <Kpi
        label="Due in range"
        value={k.dueInRange}
        tone="slate"
        href="/inspections"
      />
      <Kpi
        label="Completed"
        value={k.completed}
        tone="green"
        href="/inspections"
      />
      <Kpi
        label="In progress"
        value={k.inProgress}
        tone="amber"
        href="/inspections"
      />
      <Kpi
        label="Overdue"
        value={k.overdue}
        tone={k.overdue ? 'red' : 'slate'}
        href="/inspections"
      />
      <Kpi
        label="Failed equipment"
        value={k.failedEquipment}
        tone={k.failedEquipment ? 'amber' : 'slate'}
        href="/reports/failed-equipment"
      />
      <Kpi
        label="Open corrective actions"
        value={k.openCorrectiveActions}
        tone={k.openCorrectiveActions ? 'red' : 'slate'}
        href="/corrective-actions"
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'slate',
  href,
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'green' | 'amber' | 'red';
  href?: string;
}) {
  const toneClass: Record<string, string> = {
    slate: 'text-slate-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  };

  const content = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-semibold ${toneClass[tone]}`}>{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {content}
    </div>
  );
}

// ============================================================================
// Charts
// ============================================================================

function ChartsGrid({ data }: { data: Dashboard }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Overall completion" subtitle={`${data.charts.overallCompletionPct}% of active equipment inspected this period`}>
        <StatusPie data={data.charts.statusDistribution} />
      </ChartCard>

      <ChartCard
        title="Per-unit completion"
        subtitle="Stacked by inspection status"
      >
        {data.charts.unitCompletion.length === 0 ? (
          <EmptyChart message="No units in scope." />
        ) : (
          <UnitCompletionBar rows={data.charts.unitCompletion} />
        )}
      </ChartCard>

      <ChartCard
        title="Top failed checklist items"
        subtitle="Ranked by fail count in this period"
        className="lg:col-span-2"
      >
        {data.charts.topFailedItems.length === 0 ? (
          <EmptyChart message="No failures recorded in this period." />
        ) : (
          <TopFailedBar items={data.charts.topFailedItems} />
        )}
      </ChartCard>

      <ChartCard
        title="Open corrective actions by priority"
        subtitle="Everything not yet closed"
      >
        <CaPriorityBar counts={data.charts.openCorrectiveActionsByPriority} />
      </ChartCard>

      <ChartCard
        title="Failure summary"
        subtitle="This period's outcomes at a glance"
      >
        <FailureSummary data={data} />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}
    >
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && (
        <p className="text-xs text-slate-500">{subtitle}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-500">
      {message}
    </div>
  );
}

// ----- individual charts -----

function StatusPie({
  data,
}: {
  data: Dashboard['charts']['statusDistribution'];
}) {
  const chartData = [
    { name: 'Completed', value: data.completed, fill: COLOURS.completed },
    { name: 'In progress', value: data.inProgress, fill: COLOURS.inProgress },
    { name: 'Due', value: data.due, fill: COLOURS.due },
    { name: 'Overdue', value: data.overdue, fill: COLOURS.overdue },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return <EmptyChart message="No equipment in scope." />;
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={95}
            paddingAngle={2}
          >
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={30} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function UnitCompletionBar({ rows }: { rows: DashboardUnitCompletionRow[] }) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="unitCode" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="completed"
            stackId="s"
            fill={COLOURS.completed}
            name="Completed"
          />
          <Bar
            dataKey="inProgress"
            stackId="s"
            fill={COLOURS.inProgress}
            name="In progress"
          />
          <Bar dataKey="due" stackId="s" fill={COLOURS.due} name="Due" />
          <Bar
            dataKey="overdue"
            stackId="s"
            fill={COLOURS.overdue}
            name="Overdue"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopFailedBar({
  items,
}: {
  items: Dashboard['charts']['topFailedItems'];
}) {
  const chartData = items.map((it) => ({
    // Shorten long question text for the y-axis, keep full text in tooltip.
    label:
      it.questionText.length > 40
        ? it.questionText.slice(0, 37) + '…'
        : it.questionText,
    fullLabel: it.questionText,
    Failures: it.failCount,
    'Safety-critical': it.safetyCriticalFailCount,
  }));

  return (
    <div style={{ width: '100%', height: Math.max(220, 34 * chartData.length + 60) }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12 }}
            width={220}
          />
          <Tooltip
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload as
                | { fullLabel?: string }
                | undefined;
              return item?.fullLabel ?? String(label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Failures" fill={COLOURS.inProgress} />
          <Bar dataKey="Safety-critical" fill={COLOURS.overdue} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CaPriorityBar({
  counts,
}: {
  counts: Dashboard['charts']['openCorrectiveActionsByPriority'];
}) {
  const chartData = [
    { priority: 'Critical', count: counts.CRITICAL, fill: COLOURS.critical },
    { priority: 'High', count: counts.HIGH, fill: COLOURS.high },
    { priority: 'Medium', count: counts.MEDIUM, fill: COLOURS.medium },
    { priority: 'Low', count: counts.LOW, fill: COLOURS.low },
  ];
  const total =
    counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW;

  if (total === 0) {
    return <EmptyChart message="No open corrective actions." />;
  }

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Open">
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FailureSummary({ data }: { data: Dashboard }) {
  const failed = data.kpis.failedEquipment;
  const safetyCritical = data.charts.topFailedItems.reduce(
    (n, t) => n + t.safetyCriticalFailCount,
    0,
  );
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Failed inspections
        </dt>
        <dd
          className={`mt-1 text-2xl font-semibold ${failed ? 'text-amber-700' : 'text-slate-700'}`}
        >
          {failed}
        </dd>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Safety-critical failures
        </dt>
        <dd
          className={`mt-1 text-2xl font-semibold ${safetyCritical ? 'text-red-700' : 'text-slate-700'}`}
        >
          {safetyCritical}
        </dd>
      </div>
      <div className="col-span-2">
        <Link
          to="/reports/failed-equipment"
          className="inline-flex items-center text-sm text-brand-700 hover:underline"
        >
          View failed equipment report →
        </Link>
      </div>
    </dl>
  );
}
