import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { useSidebar } from "@/hooks/useSidebar";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useGlobalStore } from "@/hooks/useGlobalStore";
import { SalesEntryModal } from "@/components/sales-entry-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export default function SalesEntry() {
  const { isExpanded } = useSidebar();
  const { user } = useStoreAuth(); // Get user for permissions
  const { selectedStore: globalSelectedStore, setSelectedStore: setGlobalSelectedStore, shouldUseGlobalStore } = useGlobalStore();
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingSale, setDeletingSale] = useState<any>(null);
  const [localSelectedStore, setLocalSelectedStore] = useState<string>('');
  const [storeComboboxOpen, setStoreComboboxOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine which store to use - global for all-store users, local for individual store users
  const effectiveStore = shouldUseGlobalStore ? globalSelectedStore : localSelectedStore;

  // Get stores
  const { data: stores = [] } = useQuery<any[]>({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get sales data
  const { data: sales = [], isLoading: salesLoading } = useQuery<any[]>({
    queryKey: ["/api/sales", effectiveStore, dateFilter],
    enabled: !!effectiveStore,
    retry: false,
  });

  // Delete sale mutation
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: number) => {
      return await apiRequest('DELETE', `/api/sales/${saleId}`);
    },
    onSuccess: () => {
      // Invalidate specific query keys to refresh all relevant data
      // Sales data with current filters
      queryClient.invalidateQueries({ 
        queryKey: ["/api/sales", effectiveStore, dateFilter] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/sales", effectiveStore] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/sales"] 
      });
      
      // Dashboard metrics for the affected store
      queryClient.invalidateQueries({ 
        queryKey: ["/api/dashboard/metrics", effectiveStore] 
      });
      
      // Stock overview and stock data
      queryClient.invalidateQueries({ 
        queryKey: ['stores', 'stock', 'overview'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/stock/onhand", effectiveStore] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['stock', 'movements'] 
      });
      
      // Use predicate for broader invalidation of related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/inventory' ||
          query.queryKey[0] === '/api/stock' ||
          query.queryKey[0] === 'dashboard' ||
          query.queryKey[0] === 'sales'
      });
      
      toast({
        title: "Success",
        description: "Sales transaction deleted successfully",
      });
      setShowDeleteModal(false);
      setDeletingSale(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete sales transaction",
        variant: "destructive",
      });
    },
  });

  const handleEditSale = (sale: any) => {
    setEditingSale(sale);
    setShowSalesModal(true);
  };

  const handleDeleteSale = (sale: any) => {
    setDeletingSale(sale);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deletingSale) {
      deleteSaleMutation.mutate(deletingSale.penjualanId);
    }
  };

  // Auto-select store for individual store users only (all-store users use global selection)
  useEffect(() => {
    if (stores.length > 0 && !shouldUseGlobalStore && !localSelectedStore && user) {
      // If user has a specific store from authentication, use that
      if (user.store_id && !user.can_access_all_stores) {
        setLocalSelectedStore(user.store_id);
      }
      // Fallback to first store for individual store users
      else {
        setLocalSelectedStore(stores[0].kodeGudang);
      }
    }
  }, [user, stores, localSelectedStore, shouldUseGlobalStore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className={cn("flex-1 transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Entry</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Record and manage sales transactions</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Store Display - Show for individual store users */}
              {!shouldUseGlobalStore && effectiveStore && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stores.find(s => s.kodeGudang === effectiveStore)?.namaGudang || effectiveStore}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {effectiveStore}
                  </p>
                </div>
              )}
              
              {/* Store Display - Show for all-store users using global selection */}
              {shouldUseGlobalStore && effectiveStore === 'ALL_STORE' && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    All Store Access
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ALL_STORE
                  </p>
                </div>
              )}
              
              {/* Store Display - Show individual store for all-store users using global selection */}
              {shouldUseGlobalStore && effectiveStore !== 'ALL_STORE' && effectiveStore && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stores.find(s => s.kodeGudang === effectiveStore)?.namaGudang || effectiveStore}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {effectiveStore}
                  </p>
                </div>
              )}
              
              <Button
                onClick={() => setShowSalesModal(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                data-testid="button-new-sale"
                disabled={effectiveStore === 'ALL_STORE'}
                title={effectiveStore === 'ALL_STORE' ? 
                  "Please select a specific store first to record sales" : 
                  "Create a new sale transaction"
                }
              >
                <i className="fas fa-plus mr-2"></i>
                New Sale
              </Button>
            </div>
          </div>
          
          {/* Store Selector - Show for users who have access to multiple stores */}
          {shouldUseGlobalStore && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Select Store:
              </label>
              <div className="flex-1 max-w-sm">
                <Popover open={storeComboboxOpen} onOpenChange={setStoreComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={storeComboboxOpen}
                      className="w-full justify-between"
                      data-testid="select-store-main"
                    >
                      {globalSelectedStore
                        ? stores.find((store: any) => store.kodeGudang === globalSelectedStore)?.namaGudang
                        : "Choose your store..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search stores..." />
                      <CommandList>
                        <CommandEmpty>No store found.</CommandEmpty>
                        <CommandGroup>
                          {stores
                            .filter((store: any) => store.kodeGudang && store.namaGudang && store.kodeGudang.trim() !== '' && store.namaGudang.trim() !== '')
                            .map((store: any) => (
                            <CommandItem
                              key={store.kodeGudang}
                              value={store.namaGudang}
                              onSelect={() => {
                                setGlobalSelectedStore(store.kodeGudang);
                                setStoreComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  globalSelectedStore === store.kodeGudang ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {store.namaGudang}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {globalSelectedStore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGlobalSelectedStore('')}
                  className="text-xs"
                  data-testid="button-clear-store"
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="p-6">
          {/* ALL_STORE Guidance Message */}
          {effectiveStore === 'ALL_STORE' && (
            <div className="mb-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <i className="fas fa-info-circle text-yellow-600 dark:text-yellow-400 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Select a Store to Record Sales
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Sales cannot be recorded for "ALL_STORE". Please select a specific store from the dropdown above to create sales transactions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Filters */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    data-testid="input-date-filter"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="button-reset-filters"
                    onClick={() => {
                      setDateFilter(new Date().toISOString().split('T')[0]);
                    }}
                  >
                    Reset Date Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales List */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Sales Transactions
                {sales && <span className="ml-2 text-sm text-gray-500">({sales.length} records)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                          <div className="space-y-2">
                            <div className="w-32 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                            <div className="w-24 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                          <div className="w-16 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : sales && sales.length > 0 ? (
                <div className="space-y-4">
                  {sales.map((sale: any) => (
                    <div
                      key={sale.penjualanId}
                      className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                      data-testid={`card-sale-${sale.penjualanId}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-receipt text-white"></i>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {sale.kodeItem}
                            {sale.serialNumber && <span className="ml-2 text-sm text-gray-500">({sale.serialNumber})</span>}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {sale.tanggal} • Store: {sale.kodeGudang}
                          </p>
                          {sale.notes && (
                            <p className="text-xs text-gray-400 mt-1">{sale.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            Rp {parseFloat(sale.finalPrice || '0').toLocaleString()}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            {sale.preOrder && (
                              <Badge variant="secondary" className="text-xs">
                                Pre-Order
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {sale.paymentMethod || 'Cash'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditSale(sale)}
                            className="text-xs px-3 py-1"
                            data-testid={`button-edit-${sale.penjualanId}`}
                          >
                            <i className="fas fa-edit mr-1"></i>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteSale(sale)}
                            className="text-xs px-3 py-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                            data-testid={`button-delete-${sale.penjualanId}`}
                          >
                            <i className="fas fa-trash mr-1"></i>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : effectiveStore ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-receipt text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No sales found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    No sales transactions found for the selected filters.
                  </p>
                  <Button
                    onClick={() => setShowSalesModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    data-testid="button-create-first-sale"
                  >
                    Record First Sale
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-store text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a store</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Please select a store to view sales transactions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <SalesEntryModal
        isOpen={showSalesModal}
        onClose={() => {
          setShowSalesModal(false);
          setEditingSale(null);
        }}
        selectedStore={effectiveStore}
        editingSale={editingSale}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sales Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this sales transaction? This action cannot be undone.
            </DialogDescription>
            {deletingSale && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <p className="font-medium">{deletingSale.kodeItem}</p>
                <p className="text-sm text-gray-500">
                  {deletingSale.tanggal} • Store: {deletingSale.kodeGudang} • 
                  Rp {parseFloat(deletingSale.finalPrice || '0').toLocaleString()}
                </p>
              </div>
            )}
          </DialogHeader>
          <div className="flex justify-end gap-4 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteSaleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteSaleMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteSaleMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                'Delete Transaction'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
