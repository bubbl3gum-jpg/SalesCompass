import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { AuthProvider } from "@/hooks/useStoreAuth";
import { SidebarProvider } from "@/hooks/useSidebar";
import { GlobalStoreProvider } from "@/hooks/useGlobalStore";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load all page components for code splitting
const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const SalesEntry = lazy(() => import("@/pages/sales-entry"));
const Settlements = lazy(() => import("@/pages/settlements"));
const StockDashboard = lazy(() => import("@/pages/stock-dashboard"));
const StockOpname = lazy(() => import("@/pages/stock-opname"));
const StoresOverview = lazy(() => import("@/pages/stores-overview"));
const Transfers = lazy(() => import("@/pages/transfers"));
const OpeningStock = lazy(() => import("@/pages/opening-stock"));
const PriceLists = lazy(() => import("@/pages/price-lists"));
const Discounts = lazy(() => import("@/pages/discounts"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AccessDenied = lazy(() => import("@/pages/access-denied"));

// Loading component for page transitions
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="space-y-4 w-full max-w-md mx-auto p-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  </div>
);

// Permission-based route protection component
const ProtectedRoute = ({ 
  component: Component, 
  permission, 
  ...props 
}: { 
  component: React.ComponentType; 
  permission: string; 
  [key: string]: any; 
}) => {
  const { hasPermission } = useStoreAuth();
  
  if (!hasPermission(permission)) {
    return <AccessDenied />;
  }
  
  return <Component {...props} />;
};

function Router() {
  const { user, isLoading } = useStoreAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {isLoading ? (
          // Show loading for any route while authentication is loading
          <Route><PageLoader /></Route>
        ) : !user ? (
          <>
            {/* When not authenticated, show login for all routes */}
            <Route component={Login} />
          </>
        ) : (
          <>
            {/* Authenticated user routes */}
            <Route path="/" component={Dashboard} />
            <Route path="/sales-entry" component={SalesEntry} />
            <Route path="/settlements" component={Settlements} />
            <Route path="/stock-dashboard" component={Dashboard} />
            <Route path="/stock-opname" component={StockOpname} />
            <Route path="/stores-overview">
              {(params) => <ProtectedRoute component={StoresOverview} permission="store:overview" {...params} />}
            </Route>
            <Route path="/transfers" component={Transfers} />
            <Route path="/opening-stock">
              {(params) => <ProtectedRoute component={OpeningStock} permission="opening_stock:read" {...params} />}
            </Route>
            <Route path="/price-lists">
              {(params) => <ProtectedRoute component={PriceLists} permission="pricelist:read" {...params} />}
            </Route>
            <Route path="/discounts">
              {(params) => <ProtectedRoute component={Discounts} permission="discount:read" {...params} />}
            </Route>
            <Route path="/admin-settings">
              {(params) => <ProtectedRoute component={AdminSettings} permission="admin:settings" {...params} />}
            </Route>
            <Route component={NotFound} />
          </>
        )}
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <GlobalStoreProvider>
            <SidebarProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </SidebarProvider>
          </GlobalStoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
