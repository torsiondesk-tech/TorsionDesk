'use server'

import { auth } from '@clerk/nextjs/server'
import { updateStatusColor as _updateStatusColor } from '@/lib/settings'

export async function updateStatusColorAction(
  id: string,
  input: { bgColor: string; textColor: string; borderColor: string },
): Promise<{ success: boolean } > {
  const { orgId } = await auth()
  if (!orgId) throw new Error('Unauthorized')

  await _updateStatusColor(orgId, id, input)
  return { success: true }
}
