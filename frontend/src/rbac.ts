import type { AuthUser } from './types';

export type Permission =
  | 'cases.read'
  | 'cases.create'
  | 'cases.review'
  | 'cases.approve'
  | 'products.read'
  | 'policies.read'
  | 'policies.manage'
  | 'users.read'
  | 'users.create'
  | 'users.manage'
  | 'roles.read'
  | 'roles.manage'
  | 'monitoring.read';

export const ALL_PERMISSIONS: readonly Permission[] = [
  'cases.read',
  'cases.create',
  'cases.review',
  'cases.approve',
  'products.read',
  'policies.read',
  'policies.manage',
  'users.read',
  'users.create',
  'users.manage',
  'roles.read',
  'roles.manage',
  'monitoring.read',
];

// Quản trị danh tính/phân quyền là biên an toàn cấp quản lý trong mô hình RBAC đơn giản.
// Các quyền này không được gán ngược cho vai trò Nhân viên tín dụng qua bảng quyền.
export const ADMIN_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set([
  'users.read',
  'users.create',
  'users.manage',
  'roles.read',
  'roles.manage',
]);

export const ROLE_PERMISSIONS: Record<AuthUser['role'], ReadonlySet<Permission>> = {
  customer: new Set(),
  user: new Set([
    'cases.read',
    'cases.create',
    'cases.review',
    'products.read',
    'policies.read',
  ]),
  admin: new Set([
    'cases.read',
    'cases.create',
    'cases.review',
    'cases.approve',
    'products.read',
    'policies.read',
    'policies.manage',
    'users.read',
    'users.create',
    'users.manage',
    'roles.read',
    'roles.manage',
    'monitoring.read',
  ]),
};

export function can(user: AuthUser, permission: Permission): boolean {
  if (user.active === false) return false;
  if (user.permissions) return user.permissions.includes(permission);
  return ROLE_PERMISSIONS[user.role].has(permission);
}
