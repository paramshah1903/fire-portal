import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
        403
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Not allowed</h1>
      <p className="mt-2 text-sm text-slate-600">
        You do not have permission to view this page. If you believe this is a
        mistake, contact your administrator.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
