import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, TrendingUp, PiggyBank, Building2, CreditCard,
  Landmark, ArrowLeftRight, Briefcase, FileBarChart, Settings, Wallet, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/passbook", label: "Passbook", icon: BookOpen },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/investments", label: "Investments", icon: PiggyBank },
  { to: "/bank-accounts", label: "Bank Accounts", icon: Building2 },
  { to: "/credit-cards", label: "Credit Cards", icon: CreditCard },
  { to: "/emis", label: "EMIs", icon: Landmark },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/business", label: "Business Income", icon: Briefcase },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/login";
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="font-semibold leading-tight truncate">FamilyLedger</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild isActive={isActive(it.to)} tooltip={it.label}>
                    <Link to={it.to} className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      <span>{it.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={logout} className="justify-start">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
