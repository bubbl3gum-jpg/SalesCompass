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
import { Progress } from "@/components/ui/progress";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown, TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, Clock, Search, Plus, ArrowRightLeft, Calculator, ShoppingCart, Upload, Download, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface StockItem {
  kodeItem: string;
  qty: number;
  serialNumber?: string;
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
  const { isAuthenticated, isLoading } = useAuth();
  const { isExpanded } = useSidebar();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [priceSearchTerm, setPriceSearchTerm] = useState<string>('');
  const [stockSearchTerm, setStockSearchTerm] = useState<string>('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [activeImports, setActiveImports] = useState<Map<string, EventSource>>(new Map());

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

  const { data: stockData = [], isLoading: stockLoading } = useQuery<StockItem[]>({
    queryKey: ["/api/stock/onhand", selectedStore],
    enabled: !!selectedStore,
    retry: false,
  });

  // Price search query
  const { data: priceResults = [], isLoading: priceLoading } = useQuery({
    queryKey: ["/api/pricelist/search", priceSearchTerm],
    enabled: !!priceSearchTerm && priceSearchTerm.length > 2,
    retry: false,
  });

  // Get recent import jobs
  const { data: importJobs = [], isLoading: importsLoading, refetch: refetchImports } = useQuery<ImportJob[]>({
    queryKey: ["/api/import/jobs"],
    retry: false,
    refetchInterval: 5000, // Refetch every 5 seconds for updates
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
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].kodeGudang);
    }
  }, [stores, selectedStore]);

  // Update settlement form store when selectedStore changes
  useEffect(() => {
    setSettlementForm(prev => ({ ...prev, store: selectedStore }));
  }, [selectedStore]);

  const isLoadingData = metricsLoading || salesLoading || stockLoading;

  // Helper functions
  const filteredStock = stockData.filter((item: StockItem) => 
    item.kodeItem.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
    (item.serialNumber && item.serialNumber.toLowerCase().includes(stockSearchTerm.toLowerCase()))
  );

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { status: 'Out of Stock', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
    if (qty < 10) return { status: 'Low Stock', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' };
    return { status: 'In Stock', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };
  };

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

  // Import helpers
  const setupSSEForJob = (jobId: string) => {
    if (activeImports.has(jobId)) return; // Already listening

    const eventSource = new EventSource(`/api/import/progress/${jobId}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status' || data.type === 'progress') {
          // Trigger refetch to update the UI with latest progress
          refetchImports();
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      activeImports.delete(jobId);
      setActiveImports(new Map(activeImports));
    };

    activeImports.set(jobId, eventSource);
    setActiveImports(new Map(activeImports));
  };

  // Setup SSE for active import jobs
  useEffect(() => {
    importJobs.forEach(job => {
      if ((job.status === 'queued' || job.status === 'processing') && !activeImports.has(job.id)) {
        setupSSEForJob(job.id);
      }
    });

    // Cleanup closed connections
    activeImports.forEach((eventSource, jobId) => {
      const job = importJobs.find(j => j.id === jobId);
      if (!job || (job.status !== 'queued' && job.status !== 'processing')) {
        eventSource.close();
        activeImports.delete(jobId);
      }
    });

    return () => {
      // Cleanup all connections on unmount
      activeImports.forEach(eventSource => eventSource.close());
    };
  }, [importJobs]);

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
                {selectedStore ? `${stores.find(s => s.kodeGudang === selectedStore)?.namaGudang || selectedStore} • ${new Date().toLocaleDateString('id-ID')}` : 'Select a store to view data'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Store Selection */}
              {stores.length > 0 && (
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
                          {stores.map((store) => (
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
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {selectedStore ? (
            <div className="space-y-6">
              {/* Store Overview - Compact KPIs */}
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Store Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 dark:bg-black/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">On-hand</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-onhand">
                            {stockData.length.toLocaleString()}
                          </p>
                        </div>
                        <Package className="w-8 h-8 text-blue-500" />
                      </div>
                    </div>
                    <div className="bg-white/10 dark:bg-black/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sold Today</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-sold-today">
                            Rp {(metrics?.todaySales || 0).toLocaleString()}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-green-500" />
                      </div>
                    </div>
                    <div className="bg-white/10 dark:bg-black/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low-Stock</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-low-stock-alerts">
                            {stockData.filter(item => item.qty > 0 && item.qty < 10).length}
                          </p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                      </div>
                    </div>
                    <div className="bg-white/10 dark:bg-black/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inbound</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-inbound">
                            {metrics?.activeTransfers || 0}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-purple-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions - Grouped Together */}
              <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Quick Transfer */}
                    <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-20 flex flex-col items-center gap-2 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20">
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
                        <Button variant="outline" className="h-20 flex flex-col items-center gap-2 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20">
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

                    {/* Quick Pricelist Search */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          placeholder="Find Price..."
                          value={priceSearchTerm}
                          onChange={(e) => setPriceSearchTerm(e.target.value)}
                          className="pr-10"
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                      {priceSearchTerm && priceResults.length > 0 && (
                        <Card className="absolute z-10 w-64 max-h-48 overflow-y-auto">
                          <CardContent className="p-2">
                            {priceResults.slice(0, 5).map((item: any, index: number) => (
                              <div key={index} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm">
                                <div className="font-medium">{item.kodeItem}</div>
                                <div className="text-green-600 dark:text-green-400">Rp {item.harga?.toLocaleString()}</div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Quick Stock Search */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          placeholder="Find Stock..."
                          value={stockSearchTerm}
                          onChange={(e) => setStockSearchTerm(e.target.value)}
                          className="pr-10"
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                      {stockSearchTerm && filteredStock.length > 0 && (
                        <Card className="absolute z-10 w-64 max-h-48 overflow-y-auto">
                          <CardContent className="p-2">
                            {filteredStock.slice(0, 5).map((item, index) => {
                              const status = getStockStatus(item.qty);
                              return (
                                <div key={index} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm">
                                  <div className="flex justify-between items-center">
                                    <div className="font-medium">{item.kodeItem}</div>
                                    <Badge className={status.color}>{item.qty}</Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Quick Sale */}
                    <Button 
                      onClick={() => setShowSalesModal(true)}
                      variant="outline" 
                      className="h-20 flex flex-col items-center gap-2 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20"
                    >
                      <ShoppingCart className="w-6 h-6" />
                      <span className="text-sm">Quick Sale</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Analytics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Today */}
                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Sales Today</span>
                      <DollarSign className="w-4 h-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">Rp {(metrics?.todaySales || 0).toLocaleString()}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{metrics?.salesCount || 0} transactions</div>
                      <div className="flex items-center text-sm">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-green-600 dark:text-green-400">+12% vs yesterday</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pending vs Settled */}
                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Settlement Status</span>
                      <Clock className="w-4 h-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Pending</span>
                        <span className="font-semibold text-orange-600">{metrics?.pendingSettlements || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Completed</span>
                        <span className="font-semibold text-green-600">{(metrics?.salesCount || 0) - (metrics?.pendingSettlements || 0)}</span>
                      </div>
                      <Progress value={metrics?.pendingSettlements ? ((metrics.salesCount || 0) - metrics.pendingSettlements) / (metrics.salesCount || 1) * 100 : 100} className="h-2" />
                      <div className="text-xs text-center">
                        {metrics?.pendingSettlements ? (metrics.pendingSettlements > 5 ? '🔴 WARN' : '🟡 OK') : '🟢 OK'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stock Movement */}
                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Stock Movement</span>
                      <Package className="w-4 h-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">In Stock</span>
                        <span className="font-semibold text-green-600">{stockData.filter(item => item.qty >= 10).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Low Stock</span>
                        <span className="font-semibold text-orange-600">{stockData.filter(item => item.qty > 0 && item.qty < 10).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Out of Stock</span>
                        <span className="font-semibold text-red-600">{stockData.filter(item => item.qty === 0).length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Imports Widget - Live Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Imports Widget */}
                <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
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
                            <div key={job.id} className="space-y-2 p-3 bg-white/10 dark:bg-black/10 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getImportStatusIcon(job.status)}
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {job.fileName}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
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
                                    <span className="text-gray-600 dark:text-gray-400">{job.progress.stage}</span>
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {job.progress.current.toLocaleString()} / {job.progress.total.toLocaleString()}
                                      {job.progress.throughputRps && ` (${Math.round(job.progress.throughputRps)}/s)`}
                                    </span>
                                  </div>
                                  <Progress value={progressPercent} className="h-2" />
                                </div>
                              )}
                              
                              {job.status === 'completed' && job.result && (
                                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                  <span>✅ {job.result.newRecords} new</span>
                                  <span>🔄 {job.result.updatedRecords} updated</span>
                                  {job.result.errorRecords > 0 && (
                                    <span className="text-red-600">❌ {job.result.errorRecords} errors</span>
                                  )}
                                </div>
                              )}
                              
                              {job.status === 'failed' && job.error && (
                                <p className="text-xs text-red-600 dark:text-red-400 truncate">
                                  Error: {job.error}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">No recent imports</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Sales Activity */}
                {recentSales.length > 0 && (
                  <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Recent Sales Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {recentSales.slice(0, 8).map((sale, index) => (
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
              </div>

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