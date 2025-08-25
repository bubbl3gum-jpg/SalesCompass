import { useQuery } from "@tanstack/react-query";
import { useSidebar } from "@/hooks/useSidebar";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Store, 
  TrendingUp, 
  Package, 
  DollarSign, 
  BarChart3,
  ShoppingCart,
  Calendar,
  Eye
} from "lucide-react";

interface StoreData {
  store: {
    kodeGudang: string;
    namaGudang: string;
    jenisGudang: string;
  };
  metrics: {
    totalSales: string;
    totalItems: number;
    totalRevenue: string;
    averageOrderValue: string;
  };
  recentSales: any[];
}

export default function StoresOverview() {
  const { isExpanded } = useSidebar();

  // Fetch aggregated data from all stores
  const { data: storesData, isLoading, error } = useQuery<StoreData[]>({
    queryKey: ['/api/stores/dashboard'],
    retry: false,
  });

  // Calculate totals across all stores
  const totals = storesData?.reduce((acc, store) => {
    return {
      totalSales: acc.totalSales + parseInt(store.metrics.totalSales || '0'),
      totalItems: acc.totalItems + (store.metrics.totalItems || 0),
      totalRevenue: acc.totalRevenue + parseFloat(store.metrics.totalRevenue || '0'),
      totalRecentSales: acc.totalRecentSales + (store.recentSales?.length || 0)
    };
  }, {
    totalSales: 0,
    totalItems: 0,
    totalRevenue: 0,
    totalRecentSales: 0
  }) || { totalSales: 0, totalItems: 0, totalRevenue: 0, totalRecentSales: 0 };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Sidebar />
        <div className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          isExpanded ? "ml-64" : "ml-16"
        )}>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Sidebar />
        <div className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          isExpanded ? "ml-64" : "ml-16"
        )}>
          <div className="p-6">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <p className="text-red-600 dark:text-red-400">
                  Error loading stores data: {(error as Error).message}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Sidebar />
      <div className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        isExpanded ? "ml-64" : "ml-16"
      )}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Stores Overview
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Comprehensive view of all store performance and metrics
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Store className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {storesData?.length || 0} Stores
              </Badge>
            </div>
          </div>

          {/* Overall Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Sales
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totals.totalSales.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Across all stores
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Items
                </CardTitle>
                <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totals.totalItems.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Inventory across stores
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  Rp {totals.totalRevenue.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Combined revenue
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Recent Activities
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totals.totalRecentSales}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recent transactions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Individual Store Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {storesData?.map((storeData) => (
              <Card key={storeData.store.kodeGudang} className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                        {storeData.store.namaGudang}
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {storeData.store.kodeGudang}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {storeData.store.jenisGudang || 'Store'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Store Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sales</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {parseInt(storeData.metrics.totalSales || '0').toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Items</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {(storeData.metrics.totalItems || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue</span>
                      <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        Rp {parseFloat(storeData.metrics.totalRevenue || '0').toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Recent Sales */}
                  {storeData.recentSales?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent Sales</span>
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {storeData.recentSales.slice(0, 3).map((sale, index) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400 truncate">
                              {sale.tanggal} - {sale.namaKonsumen || 'Customer'}
                            </span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              Rp {parseFloat(sale.totalHarga || '0').toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Store if no stores */}
          {(!storesData || storesData.length === 0) && (
            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-12 text-center">
                <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Stores Found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Add stores to start viewing aggregated dashboard data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}