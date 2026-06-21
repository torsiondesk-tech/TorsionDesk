/**
 * Role → visible-modules map (AUTH-06, D-14/D-15).
 *
 * Role keys are the EXACT Clerk custom org-role keys (RESEARCH A2) — they surface
 * as the `o.rol` JWT claim and are matched verbatim by middleware. Diverging
 * strings would silently break route protection.
 *
 *   org:admin      → every module, INCLUDING settings
 *   org:dispatcher → operational modules, NOT settings (D-15)
 *   org:technician → no shell modules — techs are redirected to the
 *                    mobile-coming-soon page (D-14)
 */

export type Role = 'org:admin' | 'org:dispatcher' | 'org:technician'

export type ModuleKey =
  | 'dashboard'
  | 'dispatch'
  | 'jobs'
  | 'customers'
  | 'estimates'
  | 'catalog'
  | 'invoicing'
  | 'reports'
  | 'settings'
  | 'field_view'

// Operational modules a dispatcher can see (no settings).
const DISPATCHER_MODULES: ModuleKey[] = [
  'dashboard',
  'dispatch',
  'jobs',
  'customers',
  'estimates',
  'catalog',
  'invoicing',
  'reports',
]

// Admin sees everything the dispatcher does PLUS settings and field view.
const ADMIN_MODULES: ModuleKey[] = [...DISPATCHER_MODULES, 'settings', 'field_view']

const ROLE_MODULES: Record<string, ModuleKey[]> = {
  'org:admin': ADMIN_MODULES,
  'org:dispatcher': DISPATCHER_MODULES,
  'org:technician': [], // D-14 — no shell, redirected to mobile-coming-soon
}

/**
 * Returns the set of module keys the given role may see in the app shell.
 * Unknown roles get no modules (fail-closed).
 */
export function visibleModules(role: string): ModuleKey[] {
  return ROLE_MODULES[role] ?? []
}
