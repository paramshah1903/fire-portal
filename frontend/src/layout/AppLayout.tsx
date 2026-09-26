import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMS, type PermKey } from '../lib/permissions';
import { ThemeToggle } from '../theme/ThemeContext';

interface NavItem {
  to: string;
  label: string;
  perm?: PermKey;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard' }],
  },
  {
    label: 'Operations',
    items: [
      { to: '/scan', label: 'Scan', perm: PERMS.EQUIPMENT_VIEW },
      { to: '/inspections', label: 'Inspections', perm: PERMS.INSPECTION_VIEW },
      {
        to: '/corrective-actions',
        label: 'Corrective Actions',
        perm: PERMS.CORRECTIVE_ACTION_VIEW,
      },
    ],
  },
  {
    label: 'Masters',
    items: [
      { to: '/equipment', label: 'Equipment', perm: PERMS.EQUIPMENT_VIEW },
      {
        to: '/equipment-types',
        label: 'Equipment Types',
        perm: PERMS.EQUIPMENT_VIEW,
      },
      {
        to: '/checklist-templates',
        label: 'Checklist Templates',
        perm: PERMS.CHECKLIST_VIEW,
      },
      { to: '/units', label: 'Units', perm: PERMS.UNIT_VIEW },
      {
        to: '/departments',
        label: 'Departments',
        perm: PERMS.DEPARTMENT_VIEW,
      },
    ],
  },
  {
    label: 'Administration',
    items: [{ to: '/users', label: 'Users', perm: PERMS.USER_VIEW }],
  },
  {
    label: 'QR Management',
    items: [
      { to: '/qr-bulk', label: 'Bulk QR Labels', perm: PERMS.EQUIPMENT_MANAGE },
    ],
  },
  {
    label: 'Reports',
    items: [{ to: '/reports', label: 'Reports', perm: PERMS.REPORT_VIEW }],
  },
  {
    label: 'System',
    items: [{ to: '/audit-logs', label: 'Audit Logs', perm: PERMS.AUDIT_VIEW }],
  },
];

export function AppLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const visibleGroups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((i) => !i.perm || hasPermission(i.perm)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* top bar — hidden on print so PDF exports don't include app chrome */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <img
            src="/logo.jpeg"
            alt="UPL"
            className="h-8 w-auto rounded"
          />
          <div>
            <p className="text-sm font-bold tracking-tight text-brand-500">
              SafetyVerse
            </p>
            <p className="-mt-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
              by UPL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {user?.fullName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.roleName}
            </p>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile backdrop — tap to close the drawer */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-x-0 bottom-0 top-14 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar. On desktop it sits inline in the flex row. On
            mobile it becomes a fixed overlay drawer so it doesn't
            push the main content sideways off the viewport. */}
        <aside
          className={[
            // desktop
            'hidden shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block lg:w-64',
            // mobile overlay when open
            mobileOpen
              ? 'fixed inset-y-0 left-0 top-14 z-40 !block w-72 max-w-[80vw] overflow-y-auto shadow-xl lg:static lg:top-0 lg:z-auto lg:w-64 lg:shadow-none'
              : '',
            // hidden on print
            'print:hidden',
          ].join(' ')}
        >
          <nav className="p-4">
            {visibleGroups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          [
                            'block rounded-md px-3 py-1.5 text-sm',
                            isActive
                              ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                          ].join(' ')
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
