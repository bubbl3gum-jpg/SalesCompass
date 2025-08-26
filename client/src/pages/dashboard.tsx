import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Sidebar } from "@/components/sidebar";
import { SalesEntryModal } from "@/components/sales-entry-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { isExpanded } = useSidebar();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

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

  // Get dashboard metrics (original functionality)
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["/api/dashboard/metrics", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  // Get recent sales (original functionality)
  const { data: recentSales, isLoading: salesLoading } = useQuery({
    queryKey: ["/api/sales", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  // Get stock data for stock dashboard functionality
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ["/api/stock/onhand", selectedStore],
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
    if (stores && Array.isArray(stores) && stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].kodeGudang);
    }
  }, [stores, selectedStore]);

  const isLoadingData = metricsLoading || salesLoading || stockLoading;

  // Stock dashboard helper functions
  const filteredStock = stockData?.filter((item: any) => 
    item.kodeItem.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { status: 'Out of Stock', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
    if (qty < 10) return { status: 'Low Stock', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' };
    return { status: 'In Stock', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };
  };

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
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Home Overview</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor your sales and inventory in real-time</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Store Selection */}
              {stores && Array.isArray(stores) && (
                <Popover open={storeDropdownOpen} onOpenChange={setStoreDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={storeDropdownOpen}
                      className="w-64 justify-between bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 text-gray-900 dark:text-white"
                      data-testid="select-store"
                    >
                      {selectedStore
                        ? stores.find((store: any) => store.kodeGudang === selectedStore)?.namaGudang || "Select store..."
                        : "Select store..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
                    <Command>
                      <CommandInput 
                        placeholder="Search stores..." 
                        className="h-9 border-0 focus:ring-0"
                      />
                      <CommandList>
                        <CommandEmpty>No store found.</CommandEmpty>
                        <CommandGroup>
                          {stores.map((store: any) => (
                            <CommandItem
                              key={store.kodeGudang}
                              value={`${store.kodeGudang} ${store.namaGudang}`}
                              onSelect={() => {
                                setSelectedStore(store.kodeGudang);
                                setStoreDropdownOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedStore === store.kodeGudang ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{store.namaGudang}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {store.kodeGudang}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Quick Action Button */}
              <Button 
                onClick={() => setShowSalesModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-quick-sale"
              >
                <i className="fas fa-plus mr-2"></i>
                Quick Sale
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Original Dashboard Metrics */}
          {selectedStore && metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Sales</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-today-sales">
                        Rp {(metrics.todaySales || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-chart-line text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Transactions</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-sales-count">
                        {(metrics.salesCount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-receipt text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Settlements</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-pending-settlements">
                        {(metrics.pendingSettlements || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-file-invoice-dollar text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock Items</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-low-stock-items">
                        {(metrics.lowStockItems || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-exclamation-triangle text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stock Dashboard Section */}
          {selectedStore && stockData && Array.isArray(stockData) && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Stock Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-total-items">
                          {stockData.length.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-boxes text-white"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">In Stock</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-in-stock">
                          {stockData.filter((item: any) => item.qty >= 10).length.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-check-circle text-white"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-low-stock">
                          {stockData.filter((item: any) => item.qty > 0 && item.qty < 10).length.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-exclamation-triangle text-white"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Out of Stock</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-out-of-stock">
                          {stockData.filter((item: any) => item.qty === 0).length.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-times-circle text-white"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Recent Sales Section (Original functionality) */}
          {selectedStore && recentSales && Array.isArray(recentSales) && recentSales.length > 0 && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentSales.slice(0, 10).map((sale: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/10 dark:bg-black/10 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{sale.kodeItem}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(sale.tanggalJual).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">
                          Rp {(sale.totalHarga || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Qty: {sale.qty || 0}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stock Search Section */}
          {selectedStore && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
              <CardHeader>
                <CardTitle>Quick Stock Search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4">
                  <Input
                    placeholder="Search by item code or serial number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                    data-testid="input-stock-search"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setSearchTerm('')}
                    data-testid="button-clear-search"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stock Search Results */}
          {selectedStore && searchTerm && filteredStock.length > 0 && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
              <CardHeader>
                <CardTitle>Search Results ({filteredStock.length} items)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredStock.slice(0, 10).map((item: any, index: number) => {
                    const status = getStockStatus(item.qty);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-white/10 dark:bg-black/10 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{item.kodeItem}</p>
                          {item.serialNumber && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">SN: {item.serialNumber}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-gray-900 dark:text-white">{item.qty}</span>
                          <Badge className={status.color}>{status.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {selectedStore && isLoadingData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!selectedStore && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-store text-gray-500 text-2xl"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Store</h3>
              <p className="text-gray-600 dark:text-gray-400">Choose a store from the dropdown to view sales and inventory data.</p>
            </div>
          )}
        </main>
      </div>

      {/* Sales Entry Modal */}
      <SalesEntryModal 
        isOpen={showSalesModal} 
        onClose={() => setShowSalesModal(false)} 
      />
    </div>
  );
}