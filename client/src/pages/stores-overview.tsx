import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSidebar } from "@/hooks/useSidebar";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  Store, 
  Package, 
  Box,
  Boxes
} from "lucide-react";

interface InventoryItem {
  kodeItem: string;
  namaItem: string;
  sn?: string;
  qty: number;
}

interface StoreInventory {
  storeCode: string;
  summary: {
    totalItems: number;
    totalQuantity: number;
    uniqueItemCodes: number;
  };
  inventory: InventoryItem[];
}

export default function StoresOverview() {
  const { isExpanded } = useSidebar();
  const { user } = useStoreAuth();
  const [selectedStoreCode, setSelectedStoreCode] = useState<string>('');

  // Fetch all stores for the selector
  const { data: stores, isLoading: storesLoading } = useQuery<any[]>({
    queryKey: ['/api/stores'],
    queryFn: async () => {
      const response = await fetch('/api/stores', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  // Fetch inventory for the selected store
  const { data: storeInventory, isLoading: inventoryLoading, error } = useQuery<StoreInventory>({
    queryKey: ['/api/stores', selectedStoreCode, 'inventory'],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${selectedStoreCode}/inventory`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedStoreCode,
    retry: false,
  });

  // Set default store when stores load (use useEffect to avoid direct state update)
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreCode) {
      setSelectedStoreCode(stores[0].kodeGudang);
    }
  }, [stores, selectedStoreCode]);

  const selectedStore = stores?.find(store => store.kodeGudang === selectedStoreCode);
  const isLoading = storesLoading || inventoryLoading;

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
                Store Inventory Overview
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View and manage inventory for individual stores
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Store className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              {/* Store Selector */}
              <Select value={selectedStoreCode} onValueChange={setSelectedStoreCode}>
                <SelectTrigger className="w-64 bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang} ({store.kodeGudang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inventory Summary Cards */}
          {storeInventory && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Items in Stock
                  </CardTitle>
                  <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {storeInventory.summary.totalItems.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Individual inventory records
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Quantity
                  </CardTitle>
                  <Boxes className="h-4 w-4 text-green-600 dark:text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {storeInventory.summary.totalQuantity.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total units across all items
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Unique Item Codes
                  </CardTitle>
                  <Box className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {storeInventory.summary.uniqueItemCodes.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Different product types
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Inventory Details */}
          {storeInventory && storeInventory.inventory.length > 0 && (
            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Inventory Items - {selectedStore?.namaGudang} ({selectedStoreCode})
                </CardTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Complete inventory list based on transfer orders
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-900 dark:text-white">Item Code</th>
                        <th className="text-left py-2 font-medium text-gray-900 dark:text-white">Item Name</th>
                        <th className="text-left py-2 font-medium text-gray-900 dark:text-white">Serial Number</th>
                        <th className="text-right py-2 font-medium text-gray-900 dark:text-white">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeInventory.inventory.map((item, index) => (
                        <tr key={`${item.kodeItem}-${item.sn || 'no-sn'}-${index}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 text-gray-900 dark:text-white font-medium">{item.kodeItem}</td>
                          <td className="py-2 text-gray-900 dark:text-white">{item.namaItem}</td>
                          <td className="py-2 text-gray-500 dark:text-gray-400">{item.sn || '-'}</td>
                          <td className="py-2 text-right text-gray-900 dark:text-white font-semibold">{item.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No inventory message */}
          {selectedStoreCode && storeInventory && storeInventory.inventory.length === 0 && (
            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Inventory Found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  This store currently has no inventory. Create transfer orders to move stock to this store.
                </p>
              </CardContent>
            </Card>
          )}

          {/* No store selected message */}
          {!selectedStoreCode && stores && stores.length > 0 && (
            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-12 text-center">
                <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Store
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a store from the dropdown above to view its inventory.
                </p>
              </CardContent>
            </Card>
          )}

          {/* No stores available */}
          {(!stores || stores.length === 0) && !storesLoading && (
            <Card className="bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardContent className="p-12 text-center">
                <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Stores Found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Add stores to start viewing inventory data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}