import { api } from './api';
import type { RoleKey } from './permissions';

export interface UserRow {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  employeeId: string | null;
  designation: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: { id: string; key: string; name: string };
  unit: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
}

export interface RoleOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionOption {
  id: string;
  key: string;
  description: string | null;
}

export interface CreateUserInput {
  username: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  employeeId?: string | null;
  designation?: string | null;
  password: string;
  roleKey: RoleKey;
  unitId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string | null;
  mobile?: string | null;
  employeeId?: string | null;
  designation?: string | null;
  roleKey?: RoleKey;
  unitId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export async function listUsers(params: {
  search?: string;
  unitId?: string;
  includeInactive?: boolean;
} = {}): Promise<UserRow[]> {
  const { data } = await api.get<{ users: UserRow[] }>('/users', {
    params: {
      search: params.search || undefined,
      unitId: params.unitId || undefined,
      includeInactive: params.includeInactive || undefined,
    },
  });
  return data.users;
}

export async function getUser(id: string): Promise<UserRow> {
  const { data } = await api.get<{ user: UserRow }>(`/users/${id}`);
  return data.user;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const { data } = await api.post<{ user: UserRow }>('/users', input);
  return data.user;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UserRow> {
  const { data } = await api.put<{ user: UserRow }>(`/users/${id}`, input);
  return data.user;
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  await api.post(`/users/${id}/reset-password`, { newPassword });
}

export async function listRoles(): Promise<RoleOption[]> {
  const { data } = await api.get<{ roles: RoleOption[] }>('/users/roles');
  return data.roles;
}

export async function listPermissions(): Promise<PermissionOption[]> {
  const { data } = await api.get<{ permissions: PermissionOption[] }>(
    '/users/permissions',
  );
  return data.permissions;
}

export interface CreateRoleInput {
  key: string;
  name: string;
  description?: string | null;
  permissionKeys: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissionKeys?: string[];
}

export async function createRole(
  input: CreateRoleInput,
): Promise<RoleOption> {
  const { data } = await api.post<{ role: RoleOption }>('/users/roles', input);
  return data.role;
}

export async function updateRole(
  id: string,
  input: UpdateRoleInput,
): Promise<RoleOption> {
  const { data } = await api.put<{ role: RoleOption }>(
    `/users/roles/${id}`,
    input,
  );
  return data.role;
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/users/roles/${id}`);
}
