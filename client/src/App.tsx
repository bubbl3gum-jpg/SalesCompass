import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebar";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import SalesEntry from "@/pages/sales-entry";
import Settlements from "@/pages/settlements";
import StockDashboard from "@/pages/stock-dashboard";
import StockOpname from "@/pages/stock-opname";
import StoresOverview from "@/pages/stores-overview";
import Transfers from "@/pages/transfers";
import PriceLists from "@/pages/price-lists";
import Discounts from "@/pages/discounts";
import AdminSettings from "@/pages/admin-settings";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/sales-entry" component={SalesEntry} />
          <Route path="/settlements" component={Settlements} />
          <Route path="/stock-dashboard" component={StockDashboard} />
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
          </TooltipProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
