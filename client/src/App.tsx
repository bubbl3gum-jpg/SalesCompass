import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BackgroundImportTracker } from "@/components/BackgroundImportTracker";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebar";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load all page components for code splitting
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const SalesEntry = lazy(() => import("@/pages/sales-entry"));
const Settlements = lazy(() => import("@/pages/settlements"));
const StockDashboard = lazy(() => import("@/pages/stock-dashboard"));
const StockOpname = lazy(() => import("@/pages/stock-opname"));
const StoresOverview = lazy(() => import("@/pages/stores-overview"));
const Transfers = lazy(() => import("@/pages/transfers"));
const PriceLists = lazy(() => import("@/pages/price-lists"));
const Discounts = lazy(() => import("@/pages/discounts"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const NotFound = lazy(() => import("@/pages/not-found"));

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

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {isLoading || !isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/sales-entry" component={SalesEntry} />
            <Route path="/settlements" component={Settlements} />
            <Route path="/stock-dashboard">
              {() => {
                window.location.href = "/#stock-overview";
                return null;
              }}
            </Route>
            <Route path="/stock-opname" component={StockOpname} />
            <Route path="/stores-overview" component={StoresOverview} />
            <Route path="/transfers" component={Transfers} />
            <Route path="/price-lists" component={PriceLists} />
            <Route path="/discounts" component={Discounts} />
            <Route path="/admin-settings" component={AdminSettings} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SidebarProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <BackgroundImportTracker />
          </TooltipProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
