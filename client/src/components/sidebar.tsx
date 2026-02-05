import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Users, Store, LogOut, UserCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StoreAuthModal } from "./store-auth-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigationItems = [
  {
    name: "Home",
    href: "/",
    icon: "fas fa-home",
    permission: "dashboard:read"
  },
  {
    category: "Sales",
    items: [
      {
        name: "Sales Entry",
        href: "/sales-entry", 
        icon: "fas fa-cash-register",
        permission: "sales:create"
      },
      {
        name: "Settlements",
        href: "/settlements",
        icon: "fas fa-file-invoice-dollar", 
        permission: "settlement:read"
      },
      {
        name: "Price Lists",
        href: "/price-lists",
        icon: "fas fa-tags",
        permission: "pricelist:read"
      },
      {
        name: "Discounts",
        href: "/discounts", 
        icon: "fas fa-percentage",
        permission: "discount:read"
      },
    ]
  },
  {
    category: "Inventory",
    items: [
      {
        name: "Reference Sheet",
        href: "/reference-sheet",
        icon: "fas fa-clipboard-list",
        permission: "admin:settings"
      },
      {
        name: "Stock Opname",
        href: "/stock-opname",
        icon: "fas fa-clipboard-check",
        permission: "stock:opname"
      },
      {
        name: "Transfers", 
        href: "/transfers",
        icon: "fas fa-exchange-alt",
        permission: "transfer:read"
      },
      {
        name: "Virtual Store Inventory",
        href: "/virtual-inventory",
        icon: "fas fa-warehouse",
        permission: "stock:opname"
      },
    ]
  },
  {
    category: "Administration",
    items: [
      {
        name: "Payment Methods",
        href: "/payment-methods",
        icon: "fas fa-credit-card",
        permission: "admin:settings"
      },
      {
        name: "Admin Settings",
        href: "/admin-settings",
        icon: "fas fa-cogs",
        permission: "admin:settings"
      },
      {
        name: "Bazars",
        href: "/bazars",
        icon: "fas fa-store",
        permission: "admin:settings"
      },
    ]
  }
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, hasPermission, logoutMutation } = useStoreAuth(); // Use useStoreAuth instead
  const isAuthenticated = !!user;
  const { isExpanded, toggleSidebar } = useSidebar();
  const [storeAuthModalOpen, setStoreAuthModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stores for store authentication
  const { data: stores } = useQuery({
    queryKey: ['/api/stores'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch current authenticated store
  const { data: currentStoreData } = useQuery({
    queryKey: ['/api/store/current'],
    enabled: isAuthenticated,
    retry: false,
  });

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const handleChangeUser = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  // Store logout mutation
  const storeLogoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/store/logout');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Store Logout Successful",
        description: "You have been logged out from the store",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/store/current'] });
    },
    onError: (error: any) => {
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to logout from store",
        variant: "destructive",
      });
    },
  });

  const handleStoreLogout = useCallback(() => {
    storeLogoutMutation.mutate();
  }, []); // storeLogoutMutation.mutate is stable, don't need to include mutation object

  const currentStore = (currentStoreData as any)?.store;
  const canSwitchStores = (currentStoreData as any)?.canSwitchStores ?? false;
  const storeLoginType = (currentStoreData as any)?.loginType;

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
              if (!hasPermission(item.permission || '')) return null;
              
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
                  onClick={() => setLocation(item.href || '')}
                  data-testid={`nav-${(item.name || '').toLowerCase().replace(' ', '-')}`}
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
                  if (!hasPermission(subItem.permission || '')) return null;
                  
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
                      onClick={() => setLocation(subItem.href || '')}
                      data-testid={`nav-${subItem.name.toLowerCase().replace(' ', '-')}`}
                      title={!isExpanded ? subItem.name : undefined}
                    >
                      <i className={cn(subItem.icon, "w-5 h-5", isExpanded ? "mr-3" : "")}></i>
                      {isExpanded && <span>{subItem.name}</span>}
                      {!isExpanded && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {subItem.name || ''}
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Current Store Info */}
        {currentStore && (
          <div className="p-2">
            <div className={cn(
              "flex items-center bg-blue-500/10 dark:bg-blue-900/20 rounded-xl border border-blue-200/20 dark:border-blue-700/30",
              isExpanded ? "px-4 py-3" : "px-2 py-3 justify-center"
            )}>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Store className="w-4 h-4 text-white" />
              </div>
              {isExpanded ? (
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                    {currentStore.namaGudang}
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                    {currentStore.kodeGudang}
                  </p>
                </div>
              ) : (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {currentStore.namaGudang}
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Profile and Actions */}
        <div className="p-2">
          <div className={cn(
            "flex items-center bg-white/10 dark:bg-black/10 rounded-xl relative group",
            isExpanded ? "px-4 py-3" : "px-2 py-3 justify-center"
          )}>
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {(user as any)?.firstName?.charAt(0) || (user as any)?.email?.charAt(0) || 'U'}
              </span>
            </div>
            {isExpanded ? (
              <>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {(user as any)?.firstName && (user as any)?.lastName 
                      ? `${(user as any).firstName} ${(user as any).lastName}`
                      : (user as any)?.email?.split('@')[0] || 'User'
                    }
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role || 'User'}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                      data-testid="button-user-menu"
                    >
                      <UserCheck className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Account Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setStoreAuthModalOpen(true)}
                      disabled={currentStore && !canSwitchStores}
                      data-testid="menu-change-store"
                    >
                      <Store className="mr-2 h-4 w-4" />
                      {currentStore ? 
                        (canSwitchStores ? 'Change Store' : 'Store Access Restricted') 
                        : 'Login to Store'
                      }
                    </DropdownMenuItem>
                    {currentStore && (
                      <DropdownMenuItem 
                        onClick={handleStoreLogout}
                        disabled={storeLogoutMutation.isPending}
                        data-testid="menu-store-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout from Store
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleChangeUser}
                      data-testid="menu-change-user"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Change User
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      data-testid="menu-sign-out"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid="button-user-menu-collapsed"
                      title="User Options"
                    >
                      <UserCheck className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Account Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setStoreAuthModalOpen(true)}
                      disabled={currentStore && !canSwitchStores}
                      data-testid="menu-change-store"
                    >
                      <Store className="mr-2 h-4 w-4" />
                      {currentStore ? 
                        (canSwitchStores ? 'Change Store' : 'Store Access Restricted') 
                        : 'Login to Store'
                      }
                    </DropdownMenuItem>
                    {currentStore && (
                      <DropdownMenuItem 
                        onClick={handleStoreLogout}
                        disabled={storeLogoutMutation.isPending}
                        data-testid="menu-store-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout from Store
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleChangeUser}
                      data-testid="menu-change-user"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Change User
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      data-testid="menu-sign-out"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {(user as any)?.firstName && (user as any)?.lastName 
                    ? `${(user as any).firstName} ${(user as any).lastName}`
                    : (user as any)?.email?.split('@')[0] || 'User'
                  }
                </div>
              </>
            )}
          </div>
        </div>

        {/* Store Authentication Modal */}
        <StoreAuthModal
          open={storeAuthModalOpen}
          onOpenChange={setStoreAuthModalOpen}
          stores={(stores || []) as any}
          canSwitchStores={canSwitchStores}
          currentStore={currentStore}
          onSuccess={(store) => {
            // Optional: You can add additional logic here when store auth succeeds
            toast({
              title: canSwitchStores ? "Store Switched" : "Store Access Granted",
              description: `You now have access to ${store.namaGudang}`,
            });
          }}
        />
      </div>
    </div>
  );
}
