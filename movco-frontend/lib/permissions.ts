export type Role = 'owner' | 'manager' | 'staff' | 'driver';
export type Resource = 'quotes' | 'pipeline' | 'diary' | 'customers' | 'reports' | 'settings' | 'team' | 'import';
export type AccessLevel = 'full' | 'edit' | 'view' | 'own' | 'none';

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: Role;
  permissions: Record<Resource, AccessLevel>;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

export const ROLE_DEFAULTS: Record<Role, Record<Resource, AccessLevel>> = {
  owner: {
    quotes: 'full', pipeline: 'full', diary: 'full', customers: 'full',
    reports: 'full', settings: 'full', team: 'full', import: 'full',
  },
  manager: {
    quotes: 'full', pipeline: 'full', diary: 'full', customers: 'full',
    reports: 'full', settings: 'edit', team: 'view', import: 'full',
  },
  staff: {
    quotes: 'edit', pipeline: 'edit', diary: 'edit', customers: 'edit',
    reports: 'view', settings: 'none', team: 'none', import: 'none',
  },
  driver: {
    quotes: 'view', pipeline: 'none', diary: 'own', customers: 'view',
    reports: 'none', settings: 'none', team: 'none', import: 'none',
  },
};

export function hasPermission(
  companyUser: CompanyUser | null,
  resource: Resource,
  minLevel: 'view' | 'edit' | 'full' = 'view'
): boolean {
  if (!companyUser) return true;
  const level = companyUser.permissions?.[resource] || 'none';
  const hierarchy: AccessLevel[] = ['none', 'own', 'view', 'edit', 'full'];
  return hierarchy.indexOf(level) >= hierarchy.indexOf(minLevel);
}

export function roleLabel(role: Role): string {
  return { owner: 'Owner', manager: 'Manager', staff: 'Staff', driver: 'Driver' }[role] || role;
}

export function roleColor(role: Role): string {
  return {
    owner: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    staff: 'bg-green-100 text-green-700',
    driver: 'bg-yellow-100 text-yellow-700',
  }[role] || 'bg-gray-100 text-gray-700';
}

export function statusColor(status: string): string {
  return {
    active: 'bg-green-100 text-green-700',
    invited: 'bg-yellow-100 text-yellow-700',
    deactivated: 'bg-red-100 text-red-700',
  }[status] || 'bg-gray-100 text-gray-700';
}
