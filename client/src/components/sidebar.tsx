import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  
  // Get user role from auth context - for now assume System Administrator for testing
  const userRole = 'System Administrator';

  const hasPermission = (requiredRoles: string[]) => {
    return requiredRoles.includes(userRole);
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white/10 dark:bg-black/10 backdrop-blur-xl border-r border-white/20 dark:border-gray-800/50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-6 py-8">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-chart-line text-white text-lg"></i>
          </div>
          <h1 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">SalesStock</h1>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 space-y-2">
          {navigationItems.map((item, index) => {
            // Handle direct navigation items
            if ('href' in item) {
              if (!hasPermission(item.roles)) return null;
              
              return (
                <Button
                  key={index}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                    location === item.href
                      ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5"
                  )}
                  onClick={() => setLocation(item.href)}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  <i className={`${item.icon} w-5 h-5 mr-3`}></i>
                  {item.name}
                </Button>
              );
            }

            // Handle category items
            return (
              <div key={index} className="space-y-1">
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {item.category}
                </h3>
                {item.items?.map((subItem, subIndex) => {
                  if (!hasPermission(subItem.roles)) return null;
                  
                  return (
                    <Button
                      key={subIndex}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                        location === subItem.href
                          ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/30 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5"
                      )}
                      onClick={() => setLocation(subItem.href)}
                      data-testid={`nav-${subItem.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <i className={`${subItem.icon} w-5 h-5 mr-3`}></i>
                      {subItem.name}
                    </Button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4">
          <div className="flex items-center px-4 py-3 bg-white/10 dark:bg-black/10 rounded-xl">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                A
              </span>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
