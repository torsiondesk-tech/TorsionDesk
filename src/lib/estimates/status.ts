export type EstimateStatusValue =
  | 'estimate_requested'
  | 'estimate_provided'
  | 'estimate_accepted'
  | 'estimate_won'
  | 'estimate_lost'

export function estimateStatusBadgeVariant(status: string): 'outline' | 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'estimate_requested':
    case 'estimate_provided':
      return 'outline'
    case 'estimate_accepted':
      return 'default'
    case 'estimate_won':
      return 'secondary'
    case 'estimate_lost':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function estimateStatusLabel(status: string): string {
  return {
    estimate_requested: 'Requested',
    estimate_provided: 'Provided',
    estimate_accepted: 'Accepted',
    estimate_won: 'Won',
    estimate_lost: 'Lost',
  }[status] ?? status
}
