import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/providers/theme-provider'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

// `trigger` lets callers swap in a differently-styled trigger element (e.g. the
// sidebar uses a SidebarMenuButton here so the theme control shares the exact same
// collapsed-size handling and alignment as the nav items around it) while reusing
// the same dropdown/tooltip behaviour everywhere. `label`, when given, renders as
// a trailing text label next to the icon (hidden automatically when the sidebar
// collapses, matching how nav item labels behave) instead of icon-only.
export default function ThemeToggle({ trigger, label }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const ActiveIcon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={trigger ?? <Button variant="outline" size="icon" aria-label="Change theme" />}
            />
          }
        >
          <ActiveIcon aria-hidden="true" />
          {label && (
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
          )}
        </TooltipTrigger>
        <TooltipContent>Theme: {OPTIONS.find((o) => o.value === theme)?.label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          const selected = theme === option.value
          return (
            <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
              <Icon aria-hidden="true" />
              {option.label}
              {selected && <Check className="ml-auto size-3.5" aria-hidden="true" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
