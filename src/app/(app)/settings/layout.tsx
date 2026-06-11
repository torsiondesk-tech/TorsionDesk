import { SettingsTabs } from './settings-tabs'

/**
 * Settings shell layout (D-13, D-15).
 *
 * Renders the settings tab navigation (all ten sections — Company Profile, Users,
 * Job Categories, Tags, Templates, Email, SMS, Payment Methods, Tax Items, Lookup
 * Lists) beside the active section's content. Only Company Profile and Users are
 * functional in Phase 0; the rest are stubbed in <SettingsTabs/> with an
 * "Available in Phase N" note.
 *
 * Access to /settings is admin-gated server-side by the middleware (Plan 03);
 * this layout is the in-shell UX surface, not an enforcement point.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 animate-in fade-in-0 duration-300">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your workspace. Only Company Profile and Users are available
          now — the rest arrive in later phases.
        </p>
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <SettingsTabs />
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  )
}
