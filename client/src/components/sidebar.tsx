import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: "fas fa-tachometer-alt",
    roles: ["SPG", "Supervisor", "Stockist", "Sales Administrator", "Finance", "System Administrator"]
  },
  {
    category: "Sales",
    items: [
      {
        name: "Sales Entry",
        href: "/sales-entry", 
        icon: "fas fa-cash-register",
        roles: ["SPG", "Supervisor", "Sales Administrator"]
      },
      {
        name: "Settlements",
        href: "/settlements",
        icon: "fas fa-file-invoice-dollar", 
        roles: ["Supervisor", "Sales Administrator", "Finance", "System Administrator"]
      },
    ]
  },
  {
    category: "Inventory",
    items: [
      {
        name: "Stock Dashboard",
        href: "/stock-dashboard",
        icon: "fas fa-boxes",
        roles: ["Supervisor", "Stockist", "Sales Administrator", "System Administrator"]
      },
      {
        name: "Stock Opname",
        href: "/stock-opname",
        icon: "fas fa-clipboard-check",
        roles: ["Stockist", "Supervisor", "System Administrator"]
      },
      {
        name: "Transfers", 
        href: "/transfers",
        icon: "fas fa-exchange-alt",
        roles: ["Supervisor", "Stockist", "System Administrator"]
      },
    ]
  },
  {
    category: "Administration",
    items: [
      {
        name: "Price Lists",
        href: "/price-lists",
        icon: "fas fa-tags",
        roles: ["Supervisor", "System Administrator"]
      },
      {
        name: "Discounts",
        href: "/discounts", 
        icon: "fas fa-percentage",
        roles: ["Supervisor", "System Administrator"]
      },
      {
        name: "Admin Settings",
        href: "/admin-settings",
        icon: "fas fa-cogs",
        roles: ["System Administrator"]
      },
    ]
  }
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { isExpanded, toggleSidebar } = useSidebar();
  
  // Get user role from auth context - for now assume System Administrator for testing
  const userRole = 'System Administrator';

  const hasPermission = (requiredRoles: string[]) => {
    return requiredRoles.includes(userRole);
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-50 bg-white/10 dark:bg-black/10 backdrop-blur-xl border-r border-white/20 dark:border-gray-800/50 transition-all duration-300 ease-in-out",
      isExpanded ? "w-64" : "w-16"
    )}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo and Toggle */}
        <div className="flex items-center justify-between px-4 py-6">
          <div className={cn("flex items-center", !isExpanded && "justify-center w-full")}>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <i className="fas fa-chart-line text-white text-lg"></i>
            </div>
            {isExpanded && (
              <h1 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">SalesStock</h1>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            data-testid="button-toggle-sidebar"
          >
            {isExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {navigationItems.map((item, index) => {
            // Handle direct navigation items
            if ('href' in item) {
              if (!hasPermission(item.roles)) return null;
              
              return (
                <Button
                  key={index}
                  variant="ghost"
                  className={cn(
                    "w-full text-sm font-medium rounded-xl transition-colors relative group",
                    isExpanded ? "justify-start px-4 py-3" : "justify-center px-2 py-3",
                    location === item.href
                      ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5"
                  )}
                  onClick={() => setLocation(item.href)}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <i className={cn(item.icon, "w-5 h-5", isExpanded ? "mr-3" : "")}></i>
                  {isExpanded && <span>{item.name}</span>}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Button>
              );
            }

            // Handle category items
            return (
              <div key={index} className="space-y-1">
                {isExpanded && (
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {item.category}
                  </h3>
                )}
                {!isExpanded && item.items && item.items.length > 0 && (
                  <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>
                )}
                {item.items?.map((subItem, subIndex) => {
                  if (!hasPermission(subItem.roles)) return null;
                  
                  return (
                    <Button
                      key={subIndex}
                      variant="ghost"
                      className={cn(
                        "w-full text-sm font-medium rounded-xl transition-colors relative group",
                        isExpanded ? "justify-start px-4 py-3" : "justify-center px-2 py-3",
                        location === subItem.href
                          ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5"
                      )}
                      onClick={() => setLocation(subItem.href)}
                      data-testid={`nav-${subItem.name.toLowerCase().replace(' ', '-')}`}
                      title={!isExpanded ? subItem.name : undefined}
                    >
                      <i className={cn(subItem.icon, "w-5 h-5", isExpanded ? "mr-3" : "")}></i>
                      {isExpanded && <span>{subItem.name}</span>}
                      {!isExpanded && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {subItem.name}
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-2">
          <div className={cn(
            "flex items-center bg-white/10 dark:bg-black/10 rounded-xl relative group",
            isExpanded ? "px-4 py-3" : "px-2 py-3 justify-center"
          )}>
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                A
              </span>
            </div>
            {isExpanded ? (
              <>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    System Administrator
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userRole || 'User'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <i className="fas fa-sign-out-alt"></i>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleLogout}
                  data-testid="button-logout"
                  title="Logout"
                >
                  <i className="fas fa-sign-out-alt text-xs"></i>
                </Button>
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  System Administrator
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
