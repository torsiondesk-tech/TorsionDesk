'use server'

import { auth } from '@clerk/nextjs/server'
import { updateEstimateStatusColor as _updateEstimateStatusColor } from '@/lib/settings'

export async function updateEstimateStatusColorAction(
  id: string,
  input: { bgColor: string; textColor: string; borderColor: string },
): Promise<{ success: boolean }> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('Unauthorized')

  await _updateEstimateStatusColor(orgId, id, input)
  return { success: true }
}
