/**
 * AUTH-06 — role → visible-modules map unit test (RED until Wave 4 ships @/lib/roles).
 *
 * Contract (D-14, D-15, RESEARCH Pattern 5, A2 role keys):
 *   visibleModules(role: string): a set/collection of module keys the role may see.
 *   - 'org:admin'      → every module INCLUDING 'settings'
 *   - 'org:dispatcher' → 'dispatch','jobs','customers','estimates','invoicing','reports'
 *                        and NOT 'settings'
 *   - 'org:technician' → no shell modules at all (D-14: redirected to mobile-coming-soon)
 *
 * Role keys MUST be exactly the Clerk custom-role keys (RESEARCH A2):
 *   org:admin / org:dispatcher / org:technician
 */
import { describe, it, expect } from 'vitest'

// Not-yet-existing module — resolution failure is the Wave 0 RED signal.
import { visibleModules } from '@/lib/roles'

// Normalize whatever visibleModules returns (array | Set) into a plain array.
function toList(modules: unknown): string[] {
  if (modules instanceof Set) return Array.from(modules)
  if (Array.isArray(modules)) return modules as string[]
  return []
}

describe('visibleModules (AUTH-06)', () => {
  it('admin sees settings and every dispatcher module', () => {
    const mods = toList(visibleModules('org:admin'))
    expect(mods).toContain('settings')
    // Admin is a superset of the dispatcher modules.
    for (const m of ['dispatch', 'jobs', 'customers', 'estimates', 'invoicing', 'reports']) {
      expect(mods).toContain(m)
    }
  })

  it('dispatcher sees the operational modules but NOT settings (D-15)', () => {
    const mods = toList(visibleModules('org:dispatcher'))
    for (const m of ['dispatch', 'jobs', 'customers', 'estimates', 'invoicing', 'reports']) {
      expect(mods).toContain(m)
    }
    expect(mods).not.toContain('settings')
  })

  it('technician sees no shell modules (D-14 redirect)', () => {
    const mods = toList(visibleModules('org:technician'))
    expect(mods.length).toBe(0)
  })
})
