import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StockDashboard() {
  const { isExpanded } = useSidebar();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  // Get stores
  const { data: stores } = useQuery({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get stock data
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ["/api/stock/onhand", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  // Filter stock data based on search
  const filteredStock = stockData?.filter((item: any) => 
    item.kodeItem.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { status: 'Out of Stock', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
    if (qty < 10) return { status: 'Low Stock', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' };
    return { status: 'In Stock', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className={cn("flex-1 transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Stock Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor inventory levels across all stores</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50"
                data-testid="button-export-stock"
              >
                <i className="fas fa-download mr-2"></i>
                Export
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Filters */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Store
                  </label>
                  <Popover open={storeDropdownOpen} onOpenChange={setStoreDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={storeDropdownOpen}
                        className="w-full justify-between bg-white/10 dark:bg-black/10 border-white/20 dark:border-gray-800/50 text-gray-900 dark:text-white"
                        data-testid="select-store-filter"
                      >
                        {selectedStore
                          ? stores?.find((store: any) => store.kodeGudang === selectedStore)?.namaGudang
                          : "Search and select store..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-white/20 dark:border-gray-800/50">
                      <Command>
                        <CommandInput 
                          placeholder="Type to search stores..." 
                          className="h-9 border-0 focus:ring-0"
                        />
                        <CommandList>
                          <CommandEmpty>No store found.</CommandEmpty>
                          <CommandGroup>
                            {stores?.map((store: any) => (
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
                                    {store.kodeGudang} • {store.jenisGudang || 'Store'}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Items
                  </label>
                  <Input
                    placeholder="Search by item code or serial..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-items"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="button-reset-filters"
                    onClick={() => {
                      setSelectedStore('');
                      setSearchTerm('');
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Overview Cards */}
          {selectedStore && stockData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1" data-testid="text-total-items">
                        {stockData.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
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
                        {stockData.filter((item: any) => item.qty >= 10).length}
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
                        {stockData.filter((item: any) => item.qty > 0 && item.qty < 10).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
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
                        {stockData.filter((item: any) => item.qty === 0).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-times-circle text-white"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stock Items Table */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Stock Items
                {filteredStock && <span className="ml-2 text-sm text-gray-500">({filteredStock.length} items)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4">
                      <div className="flex items-center space-x-4">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="space-y-2">
                          <Skeleton className="w-24 h-4" />
                          <Skeleton className="w-32 h-3" />
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Skeleton className="w-16 h-4" />
                        <Skeleton className="w-20 h-6 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredStock.length > 0 ? (
                <div className="space-y-4">
                  {filteredStock.map((item: any, index: number) => {
                    const stockStatus = getStockStatus(item.qty);
                    return (
                      <div
                        key={`${item.kodeItem}-${item.serialNumber || index}`}
                        className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        data-testid={`row-stock-${item.kodeItem}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <i className="fas fa-cube text-white"></i>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {item.kodeItem}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.serialNumber ? `Serial: ${item.serialNumber}` : 'No Serial'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              Qty: {item.qty}
                            </p>
                          </div>
                          <Badge className={`${stockStatus.color} border-0`}>
                            {stockStatus.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : selectedStore ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-search text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No items found</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No items match your search criteria.' : 'No stock items found for this store.'}
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-store text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a store</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Please select a store to view stock information.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
