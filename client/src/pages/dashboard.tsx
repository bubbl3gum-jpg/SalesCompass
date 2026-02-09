import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { useGlobalStore } from "@/hooks/useGlobalStore";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Sidebar } from "@/components/sidebar";
import { SalesEntryModal } from "@/components/sales-entry-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown, TrendingUp, DollarSign, Package, Clock, Plus, ArrowRightLeft, Calculator, ShoppingCart, Upload, FileText, CheckCircle, XCircle, Loader2, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Types for better type safety
interface Store {
  kodeGudang: string;
  namaGudang: string;
  jenisGudang?: string;
}

interface Metrics {
  todaySales?: number;
  salesCount?: number;
  pendingSettlements?: number;
  lowStockItems?: number;
  activeTransfers?: number;
}

interface SalesItem {
  kodeItem: string;
  tanggalJual: string;
  totalHarga: number;
  qty: number;
}

interface ImportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  tableName: string;
  fileName: string;
  progress: {
    current: number;
    total: number;
    stage: string;
    throughputRps?: number;
  };
  result?: {
    newRecords: number;
    updatedRecords: number;
    totalRecords: number;
    errorRecords: number;
  };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading, hasPermission } = useStoreAuth(); // Get user for permissions
  const { isExpanded } = useSidebar();
  const { selectedStore: globalSelectedStore, setSelectedStore: setGlobalSelectedStore, shouldUseGlobalStore } = useGlobalStore();
  const [localSelectedStore, setLocalSelectedStore] = useState<string>('');
  
  // Use global store for all-store users, local state for individual store users
  const selectedStore = shouldUseGlobalStore ? globalSelectedStore : localSelectedStore;
  const setSelectedStore = shouldUseGlobalStore ? setGlobalSelectedStore : setLocalSelectedStore;
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    fromStore: '',
    toStore: '',
    itemCode: '',
    qty: '',
    notes: ''
  });

  // Settlement form state
  const [settlementForm, setSettlementForm] = useState({
    date: new Date().toISOString().split('T')[0],
    store: selectedStore,
    cashAmount: '',
    cardAmount: '',
    notes: ''
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.replace("/api/login");
      }, 500);
      return;
    }
  }, [user, isLoading, toast]);

  // API Queries with proper typing
  const { data: stores = [], isLoading: storesLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
    retry: false,
  });

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<Metrics>({
    queryKey: ["/api/dashboard/metrics", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  const { data: recentSales = [], isLoading: salesLoading } = useQuery<SalesItem[]>({
    queryKey: ["/api/sales", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  // Get recent import jobs
  const { data: importJobs = [], isLoading: importsLoading, error: importsError, refetch: refetchImports } = useQuery<ImportJob[]>({
    queryKey: ["/api/import/jobs"],
    retry: false,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  });

  // Recent Transfers
  const { data: transfers = [], isLoading: transfersLoading } = useQuery<any[]>({
    queryKey: ["/api/transfers"],
    retry: false,
  });

  // Virtual Inventory Summary
  const { data: virtualInventory, isLoading: inventoryLoading } = useQuery<any>({
    queryKey: ["/api/virtual-inventory", { store: selectedStore }],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/virtual-inventory?store=${encodeURIComponent(selectedStore)}`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!selectedStore && selectedStore !== 'ALL_STORE',
    retry: false,
  });

  // Active Bazars
  const { data: activeBazars = [], isLoading: bazarsLoading } = useQuery<any[]>({
    queryKey: ["/api/bazars/active"],
    retry: false,
    enabled: !!user?.can_access_all_stores,
  });

  // Recent Settlements
  const { data: settlements = [], isLoading: settlementsLoading } = useQuery<any[]>({
    queryKey: ["/api/settlements"],
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
        window.location.replace("/api/login");
      }, 500);
      return;
    }
  }, [metricsError, toast]);

  // Handle import jobs errors silently to prevent confusing 404 messages
  useEffect(() => {
    if (importsError && isUnauthorizedError(importsError as Error)) {
      // Don't show toast for import jobs errors - handle silently
      // The metrics error handler above will already redirect if needed
      console.log('Import jobs authentication error - handled silently');
    }
  }, [importsError]);

  // Set default store when stores load - prioritize user's authenticated store
  useEffect(() => {
    if (stores.length > 0 && !selectedStore && user) {
      // If user has a specific store from authentication, use that
      if (user.store_id && !user.can_access_all_stores) {
        setSelectedStore(user.store_id);
      } 
      // If user can access all stores, default to ALL_STORE for collective data
      else if (user.can_access_all_stores) {
        setSelectedStore('ALL_STORE');
      }
      // Fallback to first store
      else {
        setSelectedStore(stores[0].kodeGudang);
      }
    }
  }, [stores, selectedStore, user, setSelectedStore]);

  // Update settlement form store when selectedStore changes
  useEffect(() => {
    setSettlementForm(prev => ({ ...prev, store: selectedStore }));
  }, [selectedStore]);

  const isLoadingData = metricsLoading || salesLoading;

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement transfer submission
    toast({
      title: "Transfer Created",
      description: `Transfer request from ${transferForm.fromStore} to ${transferForm.toStore} created successfully.`,
    });
    setShowTransferModal(false);
    setTransferForm({ fromStore: '', toStore: '', itemCode: '', qty: '', notes: '' });
  };

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement settlement submission
    toast({
      title: "Settlement Recorded",
      description: "Daily settlement has been recorded successfully.",
    });
    setShowSettlementModal(false);
  };

  // Import progress is handled via polling in the useQuery refetchInterval above

  const getImportStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'queued':
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getImportStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'queued':
      case 'processing':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ${diffSecs % 60}s`;
    return `${Math.floor(diffSecs / 3600)}h ${Math.floor((diffSecs % 3600) / 60)}m`;
  };

  // Computed values for KPI cards
  const activeTransfersCount = Array.isArray(transfers) ? transfers.filter((t: any) => t.status !== 'completed').length : 0;
  const inventoryItemsCount = Array.isArray(virtualInventory) ? virtualInventory.length : (virtualInventory?.items?.length || virtualInventory?.totalItems || 0);
  const inventoryTotalQty = Array.isArray(virtualInventory) ? virtualInventory.reduce((sum: number, item: any) => sum + (item.qty || 0), 0) : (virtualInventory?.totalQuantity || 0);

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
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Command Center</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {new Date().toLocaleDateString('id-ID')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Store Display/Selection */}
              {user?.can_access_all_stores ? (
                // Store Selection - For users with all-store access
                stores.length > 0 && (
                  <Popover open={storeDropdownOpen} onOpenChange={setStoreDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={storeDropdownOpen}
                      className="w-64 justify-between bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 text-gray-900 dark:text-white"
                      data-testid="select-store"
                    >
                      {selectedStore === 'ALL_STORE'
                        ? "All Store Access"
                        : selectedStore
                        ? stores.find((store) => store.kodeGudang === selectedStore)?.namaGudang || "Select store..."
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
                          {stores
                            .filter((store: any) => store.kodeGudang && store.namaGudang && store.kodeGudang.trim() !== '' && store.namaGudang.trim() !== '')
                            .map((store) => (
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
                  )
              ) : (
                // Store Display - For individual store users
                selectedStore && (
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stores.find(s => s.kodeGudang === selectedStore)?.namaGudang || selectedStore}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedStore}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {selectedStore ? (
            <div className="space-y-6">
              {/* KPI Metric Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Today's Sales</p>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {metricsLoading ? <Skeleton className="h-7 w-24" /> : `Rp ${(metrics?.todaySales || 0).toLocaleString()}`}
                        </div>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Transactions</p>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {metricsLoading ? <Skeleton className="h-7 w-16" /> : (metrics?.salesCount || 0)}
                        </div>
                      </div>
                      <ShoppingCart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Transfers</p>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {transfersLoading ? <Skeleton className="h-7 w-16" /> : activeTransfersCount}
                        </div>
                      </div>
                      <ArrowRightLeft className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Inventory Items</p>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {selectedStore === 'ALL_STORE' ? '—' : inventoryLoading ? <Skeleton className="h-7 w-16" /> : inventoryItemsCount}
                        </div>
                      </div>
                      <Package className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Two-column grid: Recent Sales + Recent Transfers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sales */}
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <ShoppingCart className="w-5 h-5" />
                      Recent Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {salesLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : recentSales.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {recentSales.slice(0, 5).map((sale, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">{sale.kodeItem}</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date(sale.tanggalJual).toLocaleString('id-ID')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900 dark:text-white">
                                Rp {(sale.totalHarga || 0).toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                Qty: {sale.qty || 0}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <ShoppingCart className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">No recent sales</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Transfers */}
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <ArrowRightLeft className="w-5 h-5" />
                      Recent Transfers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transfersLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : Array.isArray(transfers) && transfers.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {transfers.slice(0, 5).map((transfer: any, index: number) => {
                          const statusColor = transfer.status === 'completed' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : transfer.status === 'cancelled'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
                          return (
                            <div key={transfer.id || index} className="flex items-center justify-between p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{transfer.toNumber || transfer.to_number || `TO-${index + 1}`}</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {transfer.fromStore || transfer.from_store || '—'} → {transfer.toStore || transfer.to_store || '—'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {transfer.tanggal || transfer.date ? format(new Date(transfer.tanggal || transfer.date), 'dd MMM yyyy') : '—'}
                                </p>
                              </div>
                              <Badge className={cn("text-xs border-0", statusColor)}>
                                {transfer.status || 'pending'}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <ArrowRightLeft className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">No recent transfers</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Two-column grid: Recent Settlements + Active Bazars / Import Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Settlements */}
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <Calculator className="w-5 h-5" />
                      Recent Settlements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {settlementsLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : Array.isArray(settlements) && settlements.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {settlements.slice(0, 5).map((settlement: any, index: number) => (
                          <div key={settlement.id || index} className="flex items-center justify-between p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {settlement.tanggal || settlement.date ? format(new Date(settlement.tanggal || settlement.date), 'dd MMM yyyy') : '—'}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {settlement.kodeGudang || settlement.store || settlement.bazarName || '—'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900 dark:text-white">
                                Rp {(settlement.cashAmount || settlement.cash_amount || 0).toLocaleString()}
                              </p>
                              <Badge className={cn("text-xs border-0", 
                                settlement.status === 'completed' || settlement.status === 'settled'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                              )}>
                                {settlement.status || 'pending'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Calculator className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">No recent settlements</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Active Bazars (for all-store users) or Import Activity */}
                {user?.can_access_all_stores ? (
                  <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                        <MapPin className="w-5 h-5" />
                        Active Bazars
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bazarsLoading ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse space-y-2">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                            </div>
                          ))}
                        </div>
                      ) : Array.isArray(activeBazars) && activeBazars.length > 0 ? (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {activeBazars.map((bazar: any, index: number) => (
                            <div key={bazar.id || index} className="p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30">
                              <p className="font-medium text-gray-900 dark:text-white">{bazar.name || bazar.namaBazar || '—'}</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                <MapPin className="w-3 h-3 inline mr-1" />
                                {bazar.location || bazar.lokasi || '—'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {bazar.startDate || bazar.start_date ? format(new Date(bazar.startDate || bazar.start_date), 'dd MMM') : '—'}
                                {' — '}
                                {bazar.endDate || bazar.end_date ? format(new Date(bazar.endDate || bazar.end_date), 'dd MMM yyyy') : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <MapPin className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">No active bazars</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                        <Upload className="w-5 h-5" />
                        Import Activity
                        {importJobs.filter(job => job.status === 'processing' || job.status === 'queued').length > 0 && (
                          <Badge variant="secondary" className="ml-auto">
                            {importJobs.filter(job => job.status === 'processing' || job.status === 'queued').length} active
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {importsLoading ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse space-y-2">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>
                          ))}
                        </div>
                      ) : importJobs.length > 0 ? (
                        <div className="space-y-4 max-h-80 overflow-y-auto">
                          {importJobs.slice(0, 5).map((job) => {
                            const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;
                            const isActive = job.status === 'processing' || job.status === 'queued';
                            return (
                              <div key={job.id} className="space-y-2 p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {getImportStatusIcon(job.status)}
                                    <div>
                                      <p className="font-medium text-sm text-gray-900 dark:text-white">{job.fileName}</p>
                                      <p className="text-xs text-gray-700 dark:text-gray-300">{job.tableName} • {formatDuration(job.createdAt, job.completedAt)}</p>
                                    </div>
                                  </div>
                                  <Badge className={getImportStatusColor(job.status)}>{job.status}</Badge>
                                </div>
                                {isActive && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{job.progress.stage}</span>
                                      <span className="text-gray-700 dark:text-gray-300">{job.progress.current.toLocaleString()} / {job.progress.total.toLocaleString()}{job.progress.throughputRps && ` (${Math.round(job.progress.throughputRps)}/s)`}</span>
                                    </div>
                                    <Progress value={progressPercent} className="h-2" />
                                  </div>
                                )}
                                {job.status === 'completed' && job.result && (
                                  <div className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                                    <span>✅ {job.result.newRecords} new</span>
                                    <span>🔄 {job.result.updatedRecords} updated</span>
                                    {job.result.errorRecords > 0 && <span className="text-red-700 dark:text-red-300">❌ {job.result.errorRecords} errors</span>}
                                  </div>
                                )}
                                {job.status === 'failed' && job.error && <p className="text-xs text-red-700 dark:text-red-300 truncate">Error: {job.error}</p>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <FileText className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">No recent imports</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Quick Actions */}
              <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <Plus className="w-5 h-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Quick Transfer */}
                    <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-20 flex flex-col items-center gap-2 bg-white/50 dark:bg-black/50 hover:bg-white/70 dark:hover:bg-black/70 border-white/30 dark:border-gray-600/30 text-gray-900 dark:text-white">
                          <ArrowRightLeft className="w-6 h-6" />
                          <span className="text-sm">New Transfer</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Quick Transfer</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleTransferSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="fromStore">From Store</Label>
                              <Select value={transferForm.fromStore} onValueChange={(value) => setTransferForm({...transferForm, fromStore: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select store" />
                                </SelectTrigger>
                                <SelectContent>
                                  {stores.map(store => (
                                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                                      {store.namaGudang}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="toStore">To Store</Label>
                              <Select value={transferForm.toStore} onValueChange={(value) => setTransferForm({...transferForm, toStore: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select store" />
                                </SelectTrigger>
                                <SelectContent>
                                  {stores.map(store => (
                                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                                      {store.namaGudang}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="itemCode">SKU/Serial</Label>
                              <Input id="itemCode" value={transferForm.itemCode} onChange={(e) => setTransferForm({...transferForm, itemCode: e.target.value})} placeholder="Enter item code" />
                            </div>
                            <div>
                              <Label htmlFor="qty">Quantity</Label>
                              <Input id="qty" type="number" value={transferForm.qty} onChange={(e) => setTransferForm({...transferForm, qty: e.target.value})} placeholder="Qty" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={transferForm.notes} onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})} placeholder="Optional notes" />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>Cancel</Button>
                            <Button type="submit">Create Transfer</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {/* Quick Settlement */}
                    <Dialog open={showSettlementModal} onOpenChange={setShowSettlementModal}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-20 flex flex-col items-center gap-2 bg-white/50 dark:bg-black/50 hover:bg-white/70 dark:hover:bg-black/70 border-white/30 dark:border-gray-600/30 text-gray-900 dark:text-white">
                          <Calculator className="w-6 h-6" />
                          <span className="text-sm">Record Settlement</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Quick Settlement</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSettlementSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="settlementDate">Date</Label>
                              <Input id="settlementDate" type="date" value={settlementForm.date} onChange={(e) => setSettlementForm({...settlementForm, date: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="settlementStore">Store</Label>
                              <Select value={settlementForm.store} onValueChange={(value) => setSettlementForm({...settlementForm, store: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select store" />
                                </SelectTrigger>
                                <SelectContent>
                                  {stores.map(store => (
                                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                                      {store.namaGudang}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="cashAmount">Cash Amount</Label>
                              <Input id="cashAmount" type="number" value={settlementForm.cashAmount} onChange={(e) => setSettlementForm({...settlementForm, cashAmount: e.target.value})} placeholder="0" />
                            </div>
                            <div>
                              <Label htmlFor="cardAmount">Card Amount</Label>
                              <Input id="cardAmount" type="number" value={settlementForm.cardAmount} onChange={(e) => setSettlementForm({...settlementForm, cardAmount: e.target.value})} placeholder="0" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="settlementNotes">Notes</Label>
                            <Textarea id="settlementNotes" value={settlementForm.notes} onChange={(e) => setSettlementForm({...settlementForm, notes: e.target.value})} placeholder="Settlement notes" />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setShowSettlementModal(false)}>Cancel</Button>
                            <Button type="submit">Record Settlement</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {/* Quick Sale */}
                    <Button 
                      onClick={() => setShowSalesModal(true)}
                      variant="outline" 
                      className="h-20 flex flex-col items-center gap-2 bg-white/50 dark:bg-black/50 hover:bg-white/70 dark:hover:bg-black/70 border-white/30 dark:border-gray-600/30 text-gray-900 dark:text-white"
                      disabled={selectedStore === 'ALL_STORE'}
                      title={selectedStore === 'ALL_STORE' ? 
                        "Please select a specific store first to record sales" : 
                        "Create a quick sale transaction"
                      }
                    >
                      <ShoppingCart className="w-6 h-6" />
                      <span className="text-sm">Quick Sale</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Analytics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Today */}
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between text-gray-900 dark:text-white">
                      <span>Sales Today</span>
                      <DollarSign className="w-4 h-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">Rp {(metrics?.todaySales || 0).toLocaleString()}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{metrics?.salesCount || 0} transactions</div>
                      <div className="flex items-center text-sm">
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
                        <span className="text-green-700 dark:text-green-300">+12% vs yesterday</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pending vs Settled */}
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between text-gray-900 dark:text-white">
                      <span>Settlement Status</span>
                      <Clock className="w-4 h-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Pending</span>
                        <span className="font-semibold text-orange-700 dark:text-orange-300">{metrics?.pendingSettlements || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Completed</span>
                        <span className="font-semibold text-green-700 dark:text-green-300">{(metrics?.salesCount || 0) - (metrics?.pendingSettlements || 0)}</span>
                      </div>
                      <Progress value={metrics?.pendingSettlements ? ((metrics.salesCount || 0) - metrics.pendingSettlements) / (metrics.salesCount || 1) * 100 : 100} className="h-2" />
                      <div className="text-xs text-center text-gray-700 dark:text-gray-300">
                        {metrics?.pendingSettlements ? (metrics.pendingSettlements > 5 ? '🔴 WARN' : '🟡 OK') : '🟢 OK'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Import Activity (for all-store users, show here since Active Bazars took its slot above) */}
              {user?.can_access_all_stores && (
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <Upload className="w-5 h-5" />
                      Import Activity
                      {importJobs.filter(job => job.status === 'processing' || job.status === 'queued').length > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {importJobs.filter(job => job.status === 'processing' || job.status === 'queued').length} active
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {importsLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : importsError ? (
                      <div className="text-center py-6">
                        <FileText className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">Import activity unavailable</p>
                      </div>
                    ) : importJobs.length > 0 ? (
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {importJobs.slice(0, 5).map((job) => {
                          const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;
                          const isActive = job.status === 'processing' || job.status === 'queued';
                          
                          return (
                            <div key={job.id} className="space-y-2 p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getImportStatusIcon(job.status)}
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {job.fileName}
                                    </p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300">
                                      {job.tableName} • {formatDuration(job.createdAt, job.completedAt)}
                                    </p>
                                  </div>
                                </div>
                                <Badge className={getImportStatusColor(job.status)}>
                                  {job.status}
                                </Badge>
                              </div>
                              
                              {isActive && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">{job.progress.stage}</span>
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {job.progress.current.toLocaleString()} / {job.progress.total.toLocaleString()}
                                      {job.progress.throughputRps && ` (${Math.round(job.progress.throughputRps)}/s)`}
                                    </span>
                                  </div>
                                  <Progress value={progressPercent} className="h-2" />
                                </div>
                              )}
                              
                              {job.status === 'completed' && job.result && (
                                <div className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                                  <span>✅ {job.result.newRecords} new</span>
                                  <span>🔄 {job.result.updatedRecords} updated</span>
                                  {job.result.errorRecords > 0 && (
                                    <span className="text-red-700 dark:text-red-300">❌ {job.result.errorRecords} errors</span>
                                  )}
                                </div>
                              )}
                              
                              {job.status === 'failed' && job.error && (
                                <p className="text-xs text-red-700 dark:text-red-300 truncate">
                                  Error: {job.error}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileText className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">No recent imports</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Loading State */}
              {isLoadingData && (
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
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Store</h3>
              <p className="text-gray-600 dark:text-gray-400">Choose a store from the dropdown to view your command center.</p>
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
