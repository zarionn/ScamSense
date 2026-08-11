import { SidebarTrigger } from '@/components/ui/sidebar'
import ThemeToggle from '@/components/layout/theme-toggle'
import AccountControl from '@/components/account/AccountControl'

// Subtle sticky utility bar for global controls only — deliberately not a
// navbar: no branding/wordmark and no page title. The sidebar already owns
// product identity/navigation, and each page's own PageHeader owns
// page-specific actions, so this stays limited to the sidebar trigger and
// the global theme/account controls, anchoring them to the page instead of
// leaving them floating over scrolling content.
export default function GlobalControls() {
  return (
    <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <SidebarTrigger />
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <AccountControl />
      </div>
    </div>
  )
}
