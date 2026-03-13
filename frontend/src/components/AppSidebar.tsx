import { Link, useLocation } from "react-router-dom";
import { Sparkles, Database, Settings, ChevronLeft, ChevronRight, LayoutDashboard, Mail, LogOut, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const navItems = [
  { id: "history", label: "AI Assistant", icon: Sparkles },
  { id: "connections", label: "Connections", icon: Database },
  { id: "modeling", label: "Modeling Studio", icon: GitBranch, route: "/dashboard/modeling" },
  { id: "dashboards", label: "Dashboards", icon: LayoutDashboard },
  { id: "reports", label: "Weekly Reports", icon: Mail },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ collapsed, onToggle, activeTab, onTabChange, onLogout }: AppSidebarProps) {
  const location = useLocation();
  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center">
          <Logo showText={!collapsed} size="sm" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              {item.route ? (
                <Link
                  to={item.route}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    location.pathname === item.route
                      ? "bg-gradient-primary-subtle text-accent border border-accent/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 shrink-0",
                    location.pathname === item.route ? "text-accent" : ""
                  )} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ) : (
                <button
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === item.id
                      ? "bg-gradient-primary-subtle text-accent border border-accent/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 shrink-0",
                    activeTab === item.id ? "text-accent" : ""
                  )} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-2">
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-destructive hover:bg-destructive/10",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        <div className={cn("flex items-center pt-2", collapsed ? "justify-center" : "justify-between border-t border-sidebar-border/50")}>
          {!collapsed && <ThemeToggle />}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-9 w-9 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
