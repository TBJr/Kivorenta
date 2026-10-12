import { Outlet } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AppNoticeProvider } from "@/components/notices/AppNotice";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardLayout({ children }: { children?: React.ReactNode }) {
  return (
    <AppNoticeProvider>
      <SidebarProvider className="app-workspace">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <DashboardHeader />
          <div className="workspace-page-main flex min-w-0 flex-1 flex-col">
            {children ?? <Outlet />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppNoticeProvider>
  );
}
