import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/';

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            UPL
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Fire Safety Portal
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in with your assigned credentials.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Username or email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-400"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Demo credentials</p>
          <table className="mt-2 w-full text-left">
            <tbody>
              <tr>
                <td className="py-0.5">Super Admin</td>
                <td className="py-0.5 font-mono">admin / Admin@123</td>
              </tr>
              <tr>
                <td className="py-0.5">Central Admin</td>
                <td className="py-0.5 font-mono">centraladmin / Central@123</td>
              </tr>
              <tr>
                <td className="py-0.5">Unit Admin</td>
                <td className="py-0.5 font-mono">unitadmin / UnitAdmin@123</td>
              </tr>
              <tr>
                <td className="py-0.5">Inspector</td>
                <td className="py-0.5 font-mono">inspector / Inspector@123</td>
              </tr>
              <tr>
                <td className="py-0.5">Viewer</td>
                <td className="py-0.5 font-mono">viewer / Viewer@123</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-slate-500">
            Dev only. Change these before deploying.
          </p>
        </div>
      </div>
    </div>
  );
}
