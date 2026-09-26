import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-brand-50 text-brand-800',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </div>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const styles: Record<string, string> = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-400',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
    ghost:
      'text-slate-700 hover:bg-slate-100 disabled:opacity-50',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
}) {
  const inputId = id ?? props.name;
  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600"
        >
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
        } ${className}`}
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function Select({
  label,
  error,
  id,
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string | null;
}) {
  const selectId = id ?? props.name;
  return (
    <div>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600"
        >
          {label}
        </label>
      )}
      <select
        {...props}
        id={selectId}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
        } ${className}`}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function TextArea({
  label,
  error,
  id,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string | null;
}) {
  const areaId = id ?? props.name;
  return (
    <div>
      {label && (
        <label
          htmlFor={areaId}
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600"
        >
          {label}
        </label>
      )}
      <textarea
        {...props}
        id={areaId}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
        } ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
