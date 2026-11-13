// Permisos en UI (PLAN §3). RLS y los RPC son la barrera real; esto solo decide qué se muestra.
export type Role = 'owner' | 'admin' | 'cashier' | 'super'
export const ROLE_LABEL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', cashier: 'Cajero', super: 'Super Admin' }
export const ROLE_CLASS: Record<string, string> = { owner: 'duenio', admin: 'admin', cashier: 'cajero', super: 'duenio' }
export const canManage = (r: Role) => r !== 'cashier'
export const canDelete = (r: Role) => r === 'owner' || r === 'super'
export const canManageStaff = (r: Role) => r === 'owner' || r === 'super'
export const canUsePos = (r: Role) => r !== 'super'
