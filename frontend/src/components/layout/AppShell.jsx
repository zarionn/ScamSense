import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import AppSidebar from '@/components/layout/AppSidebar'
import GlobalControls from '@/components/layout/GlobalControls'

export default function AppShell({ children, activePage, onNavigate, assistantHistory }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '15rem' }}>
      <AppSidebar activePage={activePage} onNavigate={onNavigate} assistantHistory={assistantHistory} />
      <SidebarInset>
        <GlobalControls />

        {/* No flex-1 here: this used to stretch to fill the remaining viewport
            height (SidebarInset is flex flex-col), leaving a large invisible
            block below short pages. Height should come from content alone. */}
        <div className="mx-auto w-full max-w-[1520px] px-4 pt-6 pb-10 sm:px-6 lg:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
