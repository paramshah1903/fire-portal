import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PermKey } from '../lib/permissions';

interface Props {
  /** If provided, user must hold all listed permissions. */
  requirePermissions?: PermKey[];
}

export function ProtectedRoute({ requirePermissions }: Props) {
  const { user, status, hasPermission } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requirePermissions && requirePermissions.length > 0) {
    if (!hasPermission(...requirePermissions)) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <Outlet />;
}
