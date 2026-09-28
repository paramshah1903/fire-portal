import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
  type PermissionOption,
  type RoleOption,
} from '../lib/apiUsers';
import { PERMS, ROLES } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';

/**
 * User Role master — CRUD roles and their permission sets.
 *
 * The five system-seeded roles show as read-only for name/key but their
 * permission sets are editable (except SUPER_ADMIN which is fully
 * immutable to prevent lock-out). Custom roles support full CRUD; they
 * cannot be deleted while at least one user is assigned to them.
 */
export function RolesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.ROLE_MANAGE);

  const [roles, setRoles] = useState<RoleOption[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, p] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(r);
      setPermissions(p);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(role: RoleOption) {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setBusy(role.id);
    setError(null);
    try {
      await deleteRole(role.id);
      await load();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles &amp; permissions"
        description="Manage user roles and which actions each role can perform. System roles are read-only for name; permissions can still be adjusted (except Super Admin, which is fully immutable)."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>New role</Button>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {roles === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : roles.length === 0 ? (
        <EmptyState title="No roles" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Name</Th>
                <Th>Key</Th>
                <Th>Type</Th>
                <Th>Users</Th>
                <Th>Permissions</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {roles.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Td className="font-medium text-slate-900 dark:text-slate-100">
                    {r.name}
                  </Td>
                  <Td className="font-mono text-xs">{r.key}</Td>
                  <Td>
                    {r.isSystem ? (
                      <Badge tone="blue">System</Badge>
                    ) : (
                      <Badge tone="green">Custom</Badge>
                    )}
                  </Td>
                  <Td>{r.userCount}</Td>
                  <Td className="text-xs text-slate-600 dark:text-slate-400">
                    {r.permissionKeys.length}
                    {r.key === ROLES.SUPER_ADMIN && (
                      <span className="ml-1 text-slate-500 dark:text-slate-400">
                        (all)
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canManage && r.key !== ROLES.SUPER_ADMIN && (
                      <Button
                        variant="secondary"
                        onClick={() => setEditing(r)}
                      >
                        Edit
                      </Button>
                    )}
                    {canManage && !r.isSystem && (
                      <button
                        type="button"
                        disabled={busy === r.id || r.userCount > 0}
                        onClick={() => void onDelete(r)}
                        className="ml-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
                        title={
                          r.userCount > 0
                            ? 'Users are assigned to this role — reassign them first.'
                            : 'Delete role'
                        }
                      >
                        Delete
                      </button>
                    )}
                    {r.key === ROLES.SUPER_ADMIN && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Immutable
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RoleEditModal
          role={editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {creating && (
        <RoleCreateModal
          permissions={permissions}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Helpers — groupings + display
// ============================================================================

/**
 * Group permissions by their resource prefix (e.g. `user.manage` and
 * `user.view` land under "User"). Makes the permission grid readable
 * instead of one long alphabetical list.
 */
function groupPermissions(perms: PermissionOption[]) {
  const groups = new Map<string, PermissionOption[]>();
  for (const p of perms) {
    const key = p.key.split('.')[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function labelForGroup(key: string): string {
  const map: Record<string, string> = {
    user: 'User',
    role: 'Role',
    unit: 'Unit',
    department: 'Department',
    equipment: 'Equipment',
    checklist: 'Checklist template',
    inspection: 'Inspection',
    corrective_action: 'Corrective action',
    report: 'Report',
    audit: 'Audit log',
  };
  return map[key] ?? key;
}

function humanPermission(key: string): string {
  const action = key.split('.').slice(1).join('.');
  const map: Record<string, string> = {
    manage: 'Manage (create / edit / delete)',
    view: 'View',
    perform: 'Perform',
    create: 'Create',
    close: 'Close',
  };
  return map[action] ?? action;
}

function PermissionGrid({
  permissions,
  selected,
  disabled,
  onToggle,
}: {
  permissions: PermissionOption[];
  selected: Set<string>;
  disabled?: boolean;
  onToggle: (key: string) => void;
}) {
  const groups = groupPermissions(permissions);
  return (
    <div className="space-y-4">
      {groups.map(([groupKey, items]) => (
        <div
          key={groupKey}
          className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-brand-600">
            {labelForGroup(groupKey)}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((p) => (
              <label
                key={p.id}
                className={`flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm ${
                  disabled ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={disabled}
                  checked={selected.has(p.key)}
                  onChange={() => onToggle(p.key)}
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {humanPermission(p.key)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono">{p.key}</span>
                    {p.description && ` — ${p.description}`}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Edit modal
// ============================================================================

function RoleEditModal({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: RoleOption;
  permissions: PermissionOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role.permissionKeys),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateRole(role.id, {
        name: role.isSystem ? undefined : name,
        description: role.isSystem ? undefined : description || null,
        permissionKeys: Array.from(selected),
      });
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Edit role — ${role.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="role-edit-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="role-edit-form" onSubmit={onSubmit} className="space-y-4">
        {role.isSystem && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            This is a system role — its name and key are locked, but
            you can adjust the permission set below.
          </div>
        )}
        <Input
          label="Name"
          required
          disabled={role.isSystem}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Key"
          value={role.key}
          disabled
          hint="Locked once created — code paths depend on the key."
        />
        <TextArea
          label="Description (optional)"
          rows={2}
          disabled={role.isSystem}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Permissions ({selected.size} of {permissions.length} selected)
          </p>
          <PermissionGrid
            permissions={permissions}
            selected={selected}
            onToggle={toggle}
          />
        </div>
        {error && <ErrorBanner message={error} />}
      </form>
    </Modal>
  );
}

// ============================================================================
// Create modal
// ============================================================================

function RoleCreateModal({
  permissions,
  onClose,
  onSaved,
}: {
  permissions: PermissionOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(k: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createRole({
        key: key.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
        permissionKeys: Array.from(selected),
      });
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="New role"
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="role-create-form" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create role'}
          </Button>
        </>
      }
    >
      <form id="role-create-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regional Fire Safety Coordinator"
          />
          <Input
            label="Key"
            required
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="e.g. REGIONAL_COORDINATOR"
            hint="UPPER_SNAKE_CASE — cannot be changed later."
          />
        </div>
        <TextArea
          label="Description (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Permissions ({selected.size} of {permissions.length} selected)
          </p>
          <PermissionGrid
            permissions={permissions}
            selected={selected}
            onToggle={toggle}
          />
        </div>
        {error && <ErrorBanner message={error} />}
      </form>
    </Modal>
  );
}

// ============================================================================
// Table primitives
// ============================================================================

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}
    >
      {children}
    </td>
  );
}
