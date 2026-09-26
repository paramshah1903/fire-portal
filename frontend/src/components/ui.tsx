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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
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
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    blue: 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300',
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
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
      'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
    ghost:
      'text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800',
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
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-600'
        } ${className}`}
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>
      )}
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
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <select
        {...props}
        id={selectId}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-600'
        } ${className}`}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>
      )}
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
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <textarea
        {...props}
        id={areaId}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-600'
        } ${className}`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
