import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import { listDepartments, listUnits, type Department, type Unit } from '../lib/apiUnits';
import {
  createUser,
  listRoles,
  listUsers,
  resetUserPassword,
  updateUser,
  type CreateUserInput,
  type RoleOption,
  type UpdateUserInput,
  type UserRow,
} from '../lib/apiUsers';
import { PERMS, ROLES, type RoleKey } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../components/ui';
import { Modal } from '../components/Modal';

export function UsersPage() {
  const { hasPermission, user: me } = useAuth();
  const canManage = hasPermission(PERMS.USER_MANAGE);
  const centralOrSuper =
    me?.roleKey === ROLES.SUPER_ADMIN || me?.roleKey === ROLES.CENTRAL_ADMIN;

  const [units, setUnits] = useState<Unit[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resettingFor, setResettingFor] = useState<UserRow | null>(null);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => undefined);
    listRoles().then(setRoles).catch(() => undefined);
  }, []);

  async function reload() {
    setError(null);
    try {
      setRows(
        await listUsers({
          search: search || undefined,
          unitId: centralOrSuper && selectedUnitId ? selectedUnitId : undefined,
          includeInactive,
        }),
      );
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId, includeInactive]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void reload();
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts, roles and unit assignments."
        actions={
          canManage && <Button onClick={() => setCreating(true)}>New user</Button>
        }
      />

      <form onSubmit={onSearchSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, username, email…"
          />
        </div>
        {centralOrSuper && (
          <div className="w-64">
            <Select
              label="Unit"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
            >
              <option value="">All units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <Button variant="secondary" type="submit" className="mb-0">
          Search
        </Button>
      </form>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No users match" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Name</Th>
                <Th>Username</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Unit</Th>
                <Th>Department</Th>
                <Th>Last login</Th>
                <Th>Status</Th>
                {canManage && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{u.fullName}</Td>
                  <Td className="font-mono text-xs">{u.username}</Td>
                  <Td>{u.email ?? '—'}</Td>
                  <Td>
                    <Badge tone="blue">{u.role.name}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">
                    {u.unit ? u.unit.code : '—'}
                  </Td>
                  <Td className="font-mono text-xs">
                    {u.department ? u.department.code : '—'}
                  </Td>
                  <Td>
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString()
                      : '—'}
                  </Td>
                  <Td>
                    {u.isActive ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="slate">Inactive</Badge>
                    )}
                  </Td>
                  {canManage && (
                    <Td className="whitespace-nowrap text-right">
                      <Button
                        variant="secondary"
                        onClick={() => setEditing(u)}
                        className="mr-2"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setResettingFor(u)}
                      >
                        Reset password
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        open={creating}
        units={units}
        roles={roles}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void reload();
        }}
      />
      <UserFormModal
        open={!!editing}
        user={editing}
        units={units}
        roles={roles}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
        }}
      />
      <ResetPasswordModal
        user={resettingFor}
        onClose={() => setResettingFor(null)}
      />
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 ${className}`}>{children}</td>;
}

interface FormState {
  username: string;
  fullName: string;
  email: string;
  mobile: string;
  employeeId: string;
  designation: string;
  password: string;
  roleKey: RoleKey;
  unitId: string;
  departmentId: string;
  isActive: boolean;
}

function initialForm(user?: UserRow | null): FormState {
  if (user) {
    return {
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? '',
      mobile: user.mobile ?? '',
      employeeId: user.employeeId ?? '',
      designation: user.designation ?? '',
      password: '',
      roleKey: user.role.key as RoleKey,
      unitId: user.unit?.id ?? '',
      departmentId: user.department?.id ?? '',
      isActive: user.isActive,
    };
  }
  return {
    username: '',
    fullName: '',
    email: '',
    mobile: '',
    employeeId: '',
    designation: '',
    password: '',
    roleKey: ROLES.INSPECTOR,
    unitId: '',
    departmentId: '',
    isActive: true,
  };
}

function UserFormModal({
  open,
  user,
  units,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean;
  user?: UserRow | null;
  units: Unit[];
  roles: RoleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(user));
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialForm(user));
      setError(null);
    }
  }, [open, user]);

  useEffect(() => {
    if (!form.unitId) {
      setDepartments([]);
      return;
    }
    listDepartments(form.unitId, true).then(setDepartments).catch(() => setDepartments([]));
  }, [form.unitId]);

  const roleRequiresUnit = useMemo(
    () =>
      form.roleKey === ROLES.UNIT_ADMIN ||
      form.roleKey === ROLES.INSPECTOR ||
      form.roleKey === ROLES.VIEWER,
    [form.roleKey],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (user) {
        const payload: UpdateUserInput = {
          fullName: form.fullName,
          email: form.email || null,
          mobile: form.mobile || null,
          employeeId: form.employeeId || null,
          designation: form.designation || null,
          roleKey: form.roleKey,
          unitId: form.unitId || null,
          departmentId: form.departmentId || null,
          isActive: form.isActive,
        };
        await updateUser(user.id, payload);
      } else {
        const payload: CreateUserInput = {
          username: form.username,
          fullName: form.fullName,
          email: form.email || null,
          mobile: form.mobile || null,
          employeeId: form.employeeId || null,
          designation: form.designation || null,
          password: form.password,
          roleKey: form.roleKey,
          unitId: form.unitId || null,
          departmentId: form.departmentId || null,
          isActive: form.isActive,
        };
        await createUser(payload);
      }
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={user ? `Edit user ${user.username}` : 'New user'}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={submitting}>
            {submitting ? 'Saving…' : user ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Username"
          name="username"
          required
          disabled={!!user}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          hint={user ? 'Usernames cannot be changed after creation.' : '3-32 lowercase letters/digits/._-'}
        />
        <Input
          label="Full name"
          name="fullName"
          required
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Mobile"
          name="mobile"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
        />
        <Input
          label="Employee ID"
          name="employeeId"
          value={form.employeeId}
          onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
        />
        <Input
          label="Designation"
          name="designation"
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
        />
        <Select
          label="Role"
          name="roleKey"
          value={form.roleKey}
          onChange={(e) =>
            setForm({ ...form, roleKey: e.target.value as RoleKey })
          }
        >
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          label={`Unit${roleRequiresUnit ? ' *' : ''}`}
          name="unitId"
          value={form.unitId}
          onChange={(e) =>
            setForm({ ...form, unitId: e.target.value, departmentId: '' })
          }
        >
          <option value="">— none —</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
        <Select
          label="Department"
          name="departmentId"
          value={form.departmentId}
          disabled={!form.unitId}
          onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
        >
          <option value="">— none —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </Select>
        {!user && (
          <Input
            label="Initial password"
            name="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="At least 8 characters with a letter and a digit."
          />
        )}
        <label className="col-span-2 mt-1 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        {error && (
          <div className="col-span-2">
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow | null;
  onClose: () => void;
}) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user) {
      setPw('');
      setError(null);
      setDone(false);
    }
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetUserPassword(user.id, pw);
      setDone(true);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={user ? `Reset password — ${user.username}` : ''}
      footer={
        done ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="reset-pw-form" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-slate-700">
          Password reset. The user has been signed out of all active sessions
          and must sign in again with the new password.
        </p>
      ) : (
        <form id="reset-pw-form" onSubmit={onSubmit} className="space-y-3">
          <Input
            label="New password"
            type="password"
            required
            minLength={8}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            hint="At least 8 characters with a letter and a digit."
          />
          {error && <ErrorBanner message={error} />}
        </form>
      )}
    </Modal>
  );
}
