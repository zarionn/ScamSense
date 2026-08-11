import {
  Info,
  Link2,
  Lock,
  MessageSquareWarning,
  Receipt,
  ScanSearch,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ThemeToggle from '@/components/layout/theme-toggle'

const ASSISTANT_ITEM = {
  key: 'assistant',
  label: 'AI Assistant',
  fullName: 'ScamSense Assistant',
  icon: Sparkles,
  available: true,
}

const DETECTOR_ITEMS = [
  { key: 'message', label: 'Message Scan', fullName: 'Message Scam Detector', icon: MessageSquareWarning, available: true },
  { key: 'url', label: 'URL Scan', fullName: 'URL Phishing Detector', icon: Link2, available: true },
  { key: 'transaction', label: 'Transaction Scan', fullName: 'Fraudulent Transaction Detector', icon: Receipt, available: true },
  { key: 'screenshot', label: 'Screenshot Scan', fullName: 'Scam Screenshot Detector', icon: ScanSearch, available: true },
]

const GENERAL_ITEMS = [
  { key: 'about', label: 'About ScamSense', fullName: 'About ScamSense', icon: Info, available: true },
  { key: 'settings', label: 'Settings', fullName: 'Settings', icon: Settings, available: true },
]

function NavButton({ item, isActive, onSelect }) {
  const Icon = item.icon

  if (item.available) {
    return (
      <SidebarMenuButton isActive={isActive} tooltip={item.fullName} onClick={() => onSelect?.(item.key)}>
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    )
  }

  // Deliberately not using the native `disabled` attribute: it also sets
  // pointer-events:none on this component, which would block the hover/focus
  // tooltip that explains *why* the item can't be used. aria-disabled keeps it
  // announced as disabled while staying focusable and hoverable.
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarMenuButton
            aria-disabled="true"
            aria-label={`${item.fullName} — coming soon`}
            className="pointer-events-auto cursor-not-allowed text-disabled-foreground dark:text-sidebar-foreground/65"
            onClick={(event) => event.preventDefault()}
          />
        }
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
        <Lock className="ml-auto size-3 shrink-0 opacity-50" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="right">Coming soon</TooltipContent>
    </Tooltip>
  )
}

export default function AppSidebar({ activePage, onNavigate }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Plain SidebarMenuButton, no size override, so the brand mark shares
                the exact same collapsed square dimensions and centring as every
                nav item and the theme control below it. The text label is
                DOM-hidden (not just clipped) when collapsed, and the built-in
                `tooltip` prop shows "ScamSense" on hover/focus in that state. */}
            <SidebarMenuButton tooltip="ScamSense" className="cursor-default hover:bg-transparent">
              <ShieldCheck className="text-primary" aria-hidden="true" />
              <span className="font-heading text-base font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                ScamSense
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* No SidebarGroupLabel here on purpose — the Assistant sits directly
            under the brand mark, above the labelled "Scam Detectors" group. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NavButton
                  item={ASSISTANT_ITEM}
                  isActive={activePage === ASSISTANT_ITEM.key}
                  onSelect={onNavigate}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Scam Detectors</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DETECTOR_ITEMS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <NavButton item={item} isActive={activePage === item.key} onSelect={onNavigate} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {GENERAL_ITEMS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <NavButton item={item} isActive={activePage === item.key} onSelect={onNavigate} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Rendered as a SidebarMenuButton (not a bare Button) so it shares
                the same collapsed size/padding/centring as the brand mark and
                nav items above it — that shared sizing is what keeps all three
                on one horizontal centre line when the sidebar is collapsed. */}
            <ThemeToggle label="Theme" trigger={<SidebarMenuButton aria-label="Change theme" />} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
