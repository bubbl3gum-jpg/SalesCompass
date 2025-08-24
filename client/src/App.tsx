import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import SalesEntry from "@/pages/sales-entry";
import Settlements from "@/pages/settlements";
import StockDashboard from "@/pages/stock-dashboard";
import Transfers from "@/pages/transfers";
import PriceLists from "@/pages/price-lists";
import Discounts from "@/pages/discounts";
import UserManagement from "@/pages/user-management";
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
          <Route path="/transfers" component={Transfers} />
          <Route path="/price-lists" component={PriceLists} />
          <Route path="/discounts" component={Discounts} />
          <Route path="/user-management" component={UserManagement} />
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
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
