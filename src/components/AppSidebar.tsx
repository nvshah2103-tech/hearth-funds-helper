import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, TrendingUp, PiggyBank, Building2, CreditCard,
  Landmark, ArrowLeftRight, Briefcase, FileBarChart, Settings, Wallet, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fyFor } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const fy = fyFor();

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/login";
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sidebar-foreground">FamilyLedger</div>
            <div className="text-[10px] text-muted-foreground tracking-wide uppercase">Family Finance</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => {
                const active = isActive(it.to);
                return (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={it.label}
                      className={cn(
                        "h-11 rounded-lg transition-colors",
                        active && "bg-sidebar-accent text-primary border-l-[3px] border-primary rounded-l-none",
                      )}
                    >
                      <Link to={it.to} className="flex items-center gap-3 px-3">
                        <it.icon className={cn("h-4 w-4", active && "text-primary")} />
                        <span className="text-sm font-medium">{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-3 py-2 text-[11px] text-muted-foreground">{fy.label}</div>
        <Button variant="ghost" size="sm" onClick={logout} className="justify-start text-sidebar-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
