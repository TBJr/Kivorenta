import { Outlet } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardLayout() {
  return (
    <SidebarProvider className="app-workspace">
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <DashboardHeader />
        <div className="workspace-page-main flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
