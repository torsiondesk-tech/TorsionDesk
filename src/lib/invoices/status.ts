/**
 * Invoice status is always derived from balance/total/dueDate — never stored
 * (D-05). These helpers match the Service Fusion badge labels.
 */

export function invoiceStatusBadgeVariant(
  balance: number,
  total: number,
  dueDate: Date | null,
): 'outline' | 'secondary' | 'default' | 'destructive' {
  if (balance <= 0) return 'default' // Paid in Full
  const isPastDue = dueDate ? new Date() > dueDate : false
  if (isPastDue) return 'destructive' // Past Due
  if (balance < total) return 'secondary' // Partially Paid
  return 'outline' // Unpaid
}

export function invoiceStatusLabel(balance: number, total: number, dueDate: Date | null): string {
  if (balance <= 0) return 'Paid in Full'
  const isPastDue = dueDate ? new Date() > dueDate : false
  if (isPastDue) return 'Past Due'
  if (balance < total) return 'Partially Paid'
  return 'Unpaid'
}
