import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Sidebar } from "@/components/sidebar";
import { SalesEntryModal } from "@/components/sales-entry-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { isExpanded } = useSidebar();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [showSalesModal, setShowSalesModal] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Get stores for store selection
  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get dashboard metrics
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["/api/dashboard/metrics", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  // Get recent sales
  const { data: recentSales, isLoading: salesLoading } = useQuery({
    queryKey: ["/api/sales", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  useEffect(() => {
    if (metricsError && isUnauthorizedError(metricsError as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [metricsError, toast]);

  // Set default store when stores load
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].kodeGudang);
    }
  }, [stores, selectedStore]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      {/* Main Content */}
      <div className={cn("flex-1 transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        {/* Top Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor your sales and inventory in real-time</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Store Selection */}
              {stores && (
                <select 
                  className="px-4 py-2 bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 rounded-xl text-gray-900 dark:text-white"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  data-testid="select-store"
                >
                  {stores.map((store: any) => (
                    <option key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang}
                    </option>
                  ))}
                </select>
              )}
              
              {/* Theme Toggle */}
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                data-testid="button-theme-toggle"
              >
                <i className="fas fa-sun dark:hidden"></i>
                <i className="fas fa-moon hidden dark:inline"></i>
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6 space-y-6">
          {/* Key Metrics Cards */}
          {selectedStore && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Today's Sales */}
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 hover:bg-white/30 dark:hover:bg-black/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Sales</p>
                      {metricsLoading ? (
                        <Skeleton className="w-24 h-8 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-todays-sales">
                          Rp {metrics?.todaySales ? parseFloat(metrics.todaySales).toLocaleString() : '0'}
                        </p>
                      )}
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                        <i className="fas fa-chart-line"></i> {metrics?.salesCount || 0} transactions
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-money-bill-wave text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pending Settlements */}
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 hover:bg-white/30 dark:hover:bg-black/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Settlements</p>
                      {metricsLoading ? (
                        <Skeleton className="w-8 h-8 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-pending-settlements">
                          {metrics?.pendingSettlements || 0}
                        </p>
                      )}
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        <i className="fas fa-clock"></i> Requires attention
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-exclamation-triangle text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Low Stock Items */}
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 hover:bg-white/30 dark:hover:bg-black/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock Items</p>
                      {metricsLoading ? (
                        <Skeleton className="w-8 h-8 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-low-stock">
                          {metrics?.lowStockItems || 0}
                        </p>
                      )}
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        <i className="fas fa-arrow-down"></i> Needs restocking
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-box-open text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Transfers */}
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 hover:bg-white/30 dark:hover:bg-black/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Transfers</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-active-transfers">
                        {metrics?.activeTransfers || 0}
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        <i className="fas fa-truck"></i> In transit
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-exchange-alt text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-300 transform hover:scale-105"
                    onClick={() => setShowSalesModal(true)}
                    data-testid="button-new-sale"
                  >
                    <div className="flex items-center">
                      <i className="fas fa-plus-circle mr-3"></i>
                      <span className="font-medium">New Sale</span>
                    </div>
                    <i className="fas fa-arrow-right"></i>
                  </Button>
                  
                  <Button 
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 transform hover:scale-105"
                    onClick={() => window.location.href = '/settlements'}
                    data-testid="button-create-settlement"
                  >
                    <div className="flex items-center">
                      <i className="fas fa-calculator mr-3"></i>
                      <span className="font-medium">Create Settlement</span>
                    </div>
                    <i className="fas fa-arrow-right"></i>
                  </Button>
                  
                  <Button 
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl transition-all duration-300 transform hover:scale-105"
                    onClick={() => window.location.href = '/transfers'}
                    data-testid="button-transfer-stock"
                  >
                    <div className="flex items-center">
                      <i className="fas fa-shipping-fast mr-3"></i>
                      <span className="font-medium">Transfer Stock</span>
                    </div>
                    <i className="fas fa-arrow-right"></i>
                  </Button>
                  
                  <Button 
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl transition-all duration-300 transform hover:scale-105"
                    onClick={() => window.location.href = '/stock-dashboard'}
                    data-testid="button-view-reports"
                  >
                    <div className="flex items-center">
                      <i className="fas fa-chart-pie mr-3"></i>
                      <span className="font-medium">View Reports</span>
                    </div>
                    <i className="fas fa-arrow-right"></i>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sales Activity */}
            <Card className="lg:col-span-2 bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Sales</h3>
                  <Button 
                    variant="ghost" 
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                    onClick={() => window.location.href = '/sales-entry'}
                    data-testid="button-view-all-sales"
                  >
                    View All <i className="fas fa-arrow-right ml-1"></i>
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {salesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4">
                        <div className="flex items-center">
                          <Skeleton className="w-10 h-10 rounded-lg" />
                          <div className="ml-3 space-y-1">
                            <Skeleton className="w-32 h-4" />
                            <Skeleton className="w-24 h-3" />
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-12 h-3" />
                        </div>
                      </div>
                    ))
                  ) : recentSales && recentSales.length > 0 ? (
                    recentSales.slice(0, 3).map((sale: any) => (
                      <div 
                        key={sale.penjualanId} 
                        className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        data-testid={`card-sale-${sale.penjualanId}`}
                      >
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <i className="fas fa-receipt text-white text-sm"></i>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {sale.kodeItem} - {sale.serialNumber || 'No Serial'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {sale.kodeGudang} • {sale.tanggal}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Rp {parseFloat(sale.finalPrice || '0').toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {sale.paymentMethod || 'Cash'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">No recent sales available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Sales Entry Modal */}
      <SalesEntryModal
        isOpen={showSalesModal}
        onClose={() => setShowSalesModal(false)}
        selectedStore={selectedStore}
      />
    </div>
  );
}
