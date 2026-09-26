import { Input } from './ui';

/**
 * Two-input date range filter. Values are ISO date strings (YYYY-MM-DD)
 * or empty. Empty = "use the server default", which is the current
 * calendar month.
 *
 * Presets provide one-click shortcuts for the common windows.
 */
export function DateRangeFilter({
  fromDate,
  toDate,
  onChange,
}: {
  fromDate: string;
  toDate: string;
  onChange: (next: { fromDate: string; toDate: string }) => void;
}) {
  function applyPreset(preset: 'this-month' | 'last-30' | 'last-90' | 'ytd') {
    const now = new Date();
    let from: Date;
    let to = now;
    switch (preset) {
      case 'this-month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last-30':
        from = new Date(now.getTime() - 30 * 86_400_000);
        break;
      case 'last-90':
        from = new Date(now.getTime() - 90 * 86_400_000);
        break;
      case 'ytd':
        from = new Date(now.getFullYear(), 0, 1);
        break;
    }
    onChange({
      fromDate: toISODate(from),
      toDate: toISODate(to),
    });
  }

  return (
    <div className="contents">
      <Input
        label="From"
        type="date"
        value={fromDate}
        onChange={(e) => onChange({ fromDate: e.target.value, toDate })}
        max={toDate || undefined}
      />
      <Input
        label="To"
        type="date"
        value={toDate}
        onChange={(e) => onChange({ fromDate, toDate: e.target.value })}
        min={fromDate || undefined}
      />
      <div className="flex flex-col justify-end">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
          Quick range
        </p>
        <div className="flex flex-wrap gap-1">
          <PresetButton onClick={() => applyPreset('this-month')}>
            This month
          </PresetButton>
          <PresetButton onClick={() => applyPreset('last-30')}>
            Last 30d
          </PresetButton>
          <PresetButton onClick={() => applyPreset('last-90')}>
            Last 90d
          </PresetButton>
          <PresetButton onClick={() => applyPreset('ytd')}>YTD</PresetButton>
          <PresetButton
            onClick={() => onChange({ fromDate: '', toDate: '' })}
          >
            Reset
          </PresetButton>
        </div>
      </div>
    </div>
  );
}

function PresetButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get the first-of-current-month as a YYYY-MM-DD, useful as a default. */
export function defaultFromDate(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** Get today as a YYYY-MM-DD. */
export function defaultToDate(): string {
  return toISODate(new Date());
}
