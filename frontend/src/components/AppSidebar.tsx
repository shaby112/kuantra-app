import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const navItems = [
  { id: "history", label: "AI Assistant", icon: "smart_toy", filledWhenActive: true },
  { id: "connections", label: "Connections", icon: "hub" },
  { id: "modeling", label: "Modeling Studio", icon: "schema", route: "/dashboard/modeling" },
  { id: "dashboards", label: "Dashboards", icon: "dashboard_customize" },
  { id: "reports", label: "Weekly Reports", icon: "equalizer" },
];

export function AppSidebar({ collapsed, onToggle, activeTab, onTabChange, onLogout }: AppSidebarProps) {
  const location = useLocation();

  const isActive = (item: typeof navItems[0]) => {
    if (item.route) return location.pathname === item.route;
    return activeTab === item.id;
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-obsidian-surface-low border-r border-obsidian-outline-variant/15 transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-6 flex items-center">
        <Link to="/">
          <Logo showText={!collapsed} size="sm" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const content = (
            <>
              <Icon
                name={item.icon}
                filled={active && item.filledWhenActive}
                className={cn("shrink-0", active ? "text-primary" : "text-zinc-500")}
                size="md"
              />
              {!collapsed && (
                <span className="font-label uppercase tracking-widest text-[10px]">
                  {item.label}
                </span>
              )}
            </>
          );

          const baseClasses = cn(
            "w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150",
            active
              ? "text-primary bg-obsidian-surface-mid border-l-2 border-primary"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-obsidian-surface-highest/50 rounded-lg"
          );

          if (item.route) {
            return (
              <Link key={item.id} to={item.route} className={baseClasses}>
                {content}
              </Link>
            );
          }

          return (
            <button key={item.id} onClick={() => onTabChange(item.id)} className={baseClasses}>
              {content}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto p-4 border-t border-obsidian-outline-variant/15 space-y-1">
        {/* Settings */}
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150",
            activeTab === "settings"
              ? "text-primary bg-obsidian-surface-mid border-l-2 border-primary"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-obsidian-surface-highest/50 rounded-lg"
          )}
        >
          <Icon name="settings" className={activeTab === "settings" ? "text-primary" : "text-zinc-500"} />
          {!collapsed && (
            <span className="font-label uppercase tracking-widest text-[10px]">Settings</span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/5 transition-all duration-150",
            collapsed && "justify-center"
          )}
        >
          <Icon name="logout" className="text-zinc-500" />
          {!collapsed && (
            <span className="font-label uppercase tracking-widest text-[10px]">Logout</span>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} size="sm" />
        </button>
      </div>
    </aside>
  );
}
