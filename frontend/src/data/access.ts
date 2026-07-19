import type { AccessUser, AuthUser, RegionCode, RoleAccess, TenantId } from '../types';

export interface TenantContext {
  id: TenantId;
  name: string;
  region: RegionCode;
}

export const TENANTS: Record<TenantId, TenantContext> = {
  'shb-north': { id: 'shb-north', name: 'SHB Bán lẻ · Miền Bắc', region: 'north' },
  'shb-central': { id: 'shb-central', name: 'SHB Bán lẻ · Miền Trung', region: 'central' },
  'shb-south': { id: 'shb-south', name: 'SHB Bán lẻ · Miền Nam', region: 'south' },
};

export const DEFAULT_ROLE_ACCESS: RoleAccess[] = [
  {
    role: 'user',
    label: 'Nhân viên tín dụng',
    permissions: [
      'cases.read',
      'cases.create',
      'cases.review',
      'products.read',
      'policies.read',
    ],
  },
  {
    role: 'admin',
    label: 'Giám đốc chi nhánh',
    permissions: [
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
    ],
  },
];

const user = (
  id: string,
  username: string,
  displayName: string,
  role: AccessUser['role'],
  tenantId: TenantId,
): AccessUser => ({
  id,
  username,
  display_name: displayName,
  role,
  tenant_id: tenantId,
  tenant_name: TENANTS[tenantId].name,
  active: true,
  activation_required: false,
});

export const INITIAL_ACCESS_USERS: AccessUser[] = [
  user('usr-north-staff', 'staff', 'Nguyễn Hoài An', 'user', 'shb-north'),
  user('usr-north-admin', 'admin', 'Trần Thu Hà', 'admin', 'shb-north'),
  user('usr-central-staff', 'staff_central', 'Võ Minh Châu', 'user', 'shb-central'),
  user('usr-central-admin', 'admin_central', 'Nguyễn Hải Yến', 'admin', 'shb-central'),
  user('usr-south-staff', 'staff_south', 'Lê Thanh Tâm', 'user', 'shb-south'),
  user('usr-south-admin', 'admin_south', 'Lê Minh Quân', 'admin', 'shb-south'),
];

export const DEMO_PASSWORDS: Record<string, string> = {
  staff: 'staff',
  admin: 'admin',
  staff_central: 'staff_central',
  admin_central: 'admin_central',
  staff_south: 'staff_south',
  admin_south: 'admin_south',
};

export function toAuthUser(accessUser: AccessUser, roleAccess: RoleAccess[]): AuthUser {
  const tenant = TENANTS[accessUser.tenant_id];
  return {
    username: accessUser.username,
    display_name: accessUser.display_name,
    role: accessUser.role,
    owner_id: null,
    tenant_id: accessUser.tenant_id,
    tenant_name: tenant.name,
    region: tenant.region,
    permissions: roleAccess.find((item) => item.role === accessUser.role)?.permissions ?? [],
    active: accessUser.active,
  };
}
