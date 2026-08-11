import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import AppSidebar from '@/components/layout/AppSidebar'
import { Separator } from '@/components/ui/separator'

export default function AppShell({ children, activePage, onNavigate }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '15rem' }}>
      <AppSidebar activePage={activePage} onNavigate={onNavigate} />
      <SidebarInset>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="font-heading text-sm font-semibold text-foreground">ScamSense</span>
        </div>

        <div className="mx-auto hidden w-full max-w-[1520px] items-center px-6 pt-4 md:flex">
          <SidebarTrigger />
        </div>

        {/* No flex-1 here: this used to stretch to fill the remaining viewport
            height (SidebarInset is flex flex-col), leaving a large invisible
            block below short pages. Height should come from content alone. */}
        <div className="mx-auto w-full max-w-[1520px] px-4 pb-10 sm:px-6 lg:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
