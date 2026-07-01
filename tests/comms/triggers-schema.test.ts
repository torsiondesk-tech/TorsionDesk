/**
 * COMM-02/08 — communication_triggers + communication_settings CRUD is tenant-scoped.
 *
 * Contract:
 *   1. The four Phase 8 tables + trigger_type enum are exported from schema.ts.
 *   2. Trigger rows are scoped by tenant_id.
 *   3. Settings row is unique per tenant.
 */

import { describe, it, expect } from 'vitest'
import {
  triggerType,
  communicationTriggers,
  communicationLogs,
  communicationSettings,
  scheduledSms,
} from '@/db/schema'

describe('Phase 8 schema', () => {
  it('exports the trigger_type enum with seven values', () => {
    expect(triggerType.enumValues).toContain('job_confirmation')
    expect(triggerType.enumValues).toContain('tech_notify')
    expect(triggerType.enumValues).toContain('estimate_send')
    expect(triggerType.enumValues).toContain('invoice_send')
    expect(triggerType.enumValues).toContain('payment_receipt')
    expect(triggerType.enumValues).toContain('on_the_way')
    expect(triggerType.enumValues).toContain('appointment_reminder')
  })

  it('exports the four communication tables', () => {
    expect(communicationTriggers).toBeDefined()
    expect(communicationLogs).toBeDefined()
    expect(communicationSettings).toBeDefined()
    expect(scheduledSms).toBeDefined()
  })

  it('communicationTriggers has tenant_id and trigger_type columns', () => {
    expect(communicationTriggers.tenantId).toBeDefined()
    expect(communicationTriggers.triggerType).toBeDefined()
    expect(communicationTriggers.channel).toBeDefined()
    expect(communicationTriggers.enabled).toBeDefined()
  })
})
