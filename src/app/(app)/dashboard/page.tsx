import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'

/**
 * Dashboard with placeholder metric cards (D-09).
 *
 * Phase 0 renders the four canonical cards — Open Jobs, Unpaid Invoices, Today's
 * Schedule, Recent Activity — each showing an em-dash value and a muted
 * "Available in Phase N" label. No fake/hardcoded numbers: the dash makes it feel
 * intentional rather than abandoned. Later phases replace the placeholder with
 * real metrics.
 */
type MetricCard = {
  title: string
  /** The phase that lights this card up — surfaced in the muted note. */
  availableInPhase: string
}

const CARDS: MetricCard[] = [
  { title: 'Open Jobs', availableInPhase: 'Phase 3' },
  { title: 'Unpaid Invoices', availableInPhase: 'Phase 7' },
  { title: "Today's Schedule", availableInPhase: 'Phase 4' },
  { title: 'Recent Activity', availableInPhase: 'Phase 3' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your business at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl font-bold">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Available in {card.availableInPhase}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
