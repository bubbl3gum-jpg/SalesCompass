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
import { Check, ChevronsUpDown, TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, Clock, Search, Plus, ArrowRightLeft, Calculator, ShoppingCart, Upload, Download, FileText, CheckCircle, XCircle, Loader2, Calendar, BarChart3, Activity, RefreshCw, X } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, ComposedChart } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import * as z from "zod";

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

// Schema for pricing form
const pricelistSchema = z.object({
  kodeItem: z.string().min(1, "Item code is required"),
  normalPrice: z.number().min(0.01, "Price must be greater than 0"),
  sp: z.number().optional(),
});

type PricelistFormData = z.infer<typeof pricelistSchema>;

// Resolve Pricing Modal Component
function ResolvePricingModal({
  isOpen,
  onClose,
  stockWithoutPricing,
  onPricingResolved
}: {
  isOpen: boolean;
  onClose: () => void;
  stockWithoutPricing: any[];
  onPricingResolved: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PricelistFormData>({
    resolver: zodResolver(pricelistSchema),
    defaultValues: {
      kodeItem: "",
      normalPrice: 0,
      sp: 0,
    }
  });

  const uniqueItems = [...new Set(stockWithoutPricing.map(item => item.kodeItem))];

  const handleSubmit = async (data: PricelistFormData) => {
    try {
      setIsSubmitting(true);

      const payload = {
        sn: null,
        kodeItem: data.kodeItem,
        normalPrice: data.normalPrice,
        sp: data.sp,
      };

      await apiRequest('/api/pricelist', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast({
        title: "Pricing Added",
        description: `Successfully added pricing for ${data.kodeItem}`,
      });

      // Reset form and close modal
      form.reset();
      onClose();
      onPricingResolved(); // Refresh stock data

    } catch (error: any) {
      console.error("Error adding pricing:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add pricing",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Resolve Pricing Issue
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Item Selection */}
            <FormField
              control={form.control}
              name="kodeItem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Item Without Pricing</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-item-code">
                        <SelectValue placeholder="Choose an item to add pricing for" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {uniqueItems.map((itemCode) => (
                        <SelectItem key={itemCode} value={itemCode}>
                          {itemCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Normal Price */}
            <FormField
              control={form.control}
              name="normalPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Normal Price (Rp)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Enter normal price"
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      data-testid="input-normal-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Special Price */}
            <FormField
              control={form.control}
              name="sp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Price (Rp) - Optional</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter special price (optional)"
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      data-testid="input-special-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-pricing"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-save-pricing"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Pricing
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [priceSearchTerm, setPriceSearchTerm] = useState<string>('');
  const [stockSearchTerm, setStockSearchTerm] = useState<string>('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [movementsViewType, setMovementsViewType] = useState<'chart' | 'table'>('chart');
  const [stockViewType, setStockViewType] = useState<'no-pricing' | 'on-hand' | 'sold-today' | 'low-stock' | 'inbound'>('no-pricing');
  const [showResolvePricingModal, setShowResolvePricingModal] = useState(false);

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

  // Stock overview from new stock table (for selected store)
  const { data: stockOverview, isLoading: stockOverviewLoading } = useQuery({
    queryKey: ['stores', 'stock', 'overview', { storeId: selectedStore, limit: 10 }],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const params = new URLSearchParams();
      if (selectedStore && selectedStore !== 'ALL_STORE') {
        params.append('store_id', selectedStore);
      }
      params.append('limit_items', '10');
      
      const response = await fetch(`/api/stores/stock/overview?${params}`, {
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedStore,
    retry: false,
  });

  // All stores overview data (for stores overview section)
  const { data: allStoresOverview, isLoading: allStoresOverviewLoading, refetch: refetchAllStores, isFetching: isRefreshingAllStores } = useQuery({
    queryKey: ['stores', 'stock', 'all-overview'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Don't pass store_id parameter to get all stores data
      const response = await fetch('/api/stores/stock/overview', {
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  // Stock movements from new stock table with dynamic date range
  const to = format(endOfDay(dateRange.to), 'yyyy-MM-dd');
  const from = format(startOfDay(dateRange.from), 'yyyy-MM-dd');
  
  const { data: stockMovements, isLoading: stockMovementsLoading } = useQuery({
    queryKey: ['stock', 'movements', { storeId: selectedStore, from, to }],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const params = new URLSearchParams();
      if (selectedStore && selectedStore !== 'ALL_STORE') {
        params.append('store_id', selectedStore);
      }
      params.append('from', from);
      params.append('to', to);
      
      const response = await fetch(`/api/stock/movements?${params}`, {
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedStore,
    retry: false,
  });

  // Price search query (only if user has permission)
  const { data: priceResults = [], isLoading: priceLoading } = useQuery<any[]>({
    queryKey: ["/api/pricelist/search", priceSearchTerm],
    enabled: !!priceSearchTerm && priceSearchTerm.length > 2 && hasPermission("pricelist:read"),
    retry: false,
  });

  // Get recent import jobs
  const { data: importJobs = [], isLoading: importsLoading, error: importsError, refetch: refetchImports } = useQuery<ImportJob[]>({
    queryKey: ["/api/import/jobs"],
    retry: false,
    refetchInterval: 5000, // Refetch every 5 seconds for updates
    refetchIntervalInBackground: false, // Don't refetch when window is not focused
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Get stock without pricing
  const { data: stockWithoutPricing = [], isLoading: stockWithoutPricingLoading } = useQuery<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>>({  
    queryKey: ["/api/stock/without-pricing", selectedStore],
    enabled: !!selectedStore,
    retry: false,
    staleTime: 30000,
  });
  
  // Get actual stock data from stock table
  const { data: stockData = [], isLoading: stockDataLoading } = useQuery<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>>({
    queryKey: ["/api/stock/onhand", selectedStore],
    enabled: !!selectedStore, // Always fetch when store is selected
    retry: false,
    staleTime: 30000,
  });

  // Get sold today items
  const { data: soldTodayItems = [], isLoading: soldTodayLoading } = useQuery<Array<{
    kodeItem: string;
    serialNumber: string;
    qty: number;
    tanggalOut: string | null;
  }>>({  
    queryKey: ["/api/stock/sold-today", selectedStore],
    enabled: !!selectedStore, // Always fetch when store is selected
    retry: false,
    staleTime: 30000,
  });

  // Get low stock items
  const { data: lowStockItems = [], isLoading: lowStockLoading } = useQuery<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>>({  
    queryKey: ["/api/stock/low-stock", selectedStore],
    enabled: !!selectedStore, // Always fetch when store is selected
    retry: false,
    staleTime: 30000,
  });

  // Get inbound items
  const { data: inboundItems = [], isLoading: inboundLoading } = useQuery<Array<{
    toNumber: string;
    kodeItem: string;
    namaItem: string | null;
    qty: number;
    fromStore: string;
    tanggal: string | null;
  }>>({  
    queryKey: ["/api/stock/inbound", selectedStore],
    enabled: !!selectedStore, // Always fetch when store is selected
    retry: false,
    staleTime: 30000,
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

  const isLoadingData = metricsLoading || salesLoading || stockOverviewLoading || stockMovementsLoading || allStoresOverviewLoading;

  // Helper functions - use top items from stock overview for filtering
  const filteredStock = stockOverview?.activeStore?.topItems?.filter((item: any) => 
    item.kodeItem.toLowerCase().includes(stockSearchTerm.toLowerCase())
  ) || [];

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

  // Data processing functions for stock movements
  const processStockMovementsData = (data: any) => {
    if (!data?.in || !data?.out) return [];
    
    // Create a map of all dates in the range
    const dateMap = new Map();
    
    // Add IN data
    data.in.forEach((item: any) => {
      dateMap.set(item.date, {
        date: item.date,
        inCount: item.count,
        outCount: 0,
        netMovement: item.count
      });
    });
    
    // Add OUT data
    data.out.forEach((item: any) => {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.outCount = item.count;
        existing.netMovement = existing.inCount - item.count;
      } else {
        dateMap.set(item.date, {
          date: item.date,
          inCount: 0,
          outCount: item.count,
          netMovement: -item.count
        });
      }
    });
    
    // Convert to array and sort by date
    return Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        dateFormatted: format(new Date(item.date), 'MMM dd'),
        fullDate: format(new Date(item.date), 'MMM dd, yyyy')
      }));
  };

  const getMovementsSummary = (data: any[]) => {
    return {
      totalIn: data.reduce((sum, item) => sum + item.inCount, 0),
      totalOut: data.reduce((sum, item) => sum + item.outCount, 0),
      netMovement: data.reduce((sum, item) => sum + item.netMovement, 0),
      daysWithActivity: data.filter(item => item.inCount > 0 || item.outCount > 0).length
    };
  };

  const chartData = processStockMovementsData(stockMovements);
  const movementsSummary = getMovementsSummary(chartData);

  const chartConfig = {
    inCount: {
      label: "Stock IN",
      color: "hsl(142, 76%, 36%)", // Green for incoming
    },
    outCount: {
      label: "Stock OUT", 
      color: "hsl(0, 84%, 60%)", // Red for outgoing
    },
    netMovement: {
      label: "Net Movement",
      color: "hsl(217, 91%, 60%)", // Blue for net
    },
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
              {/* Stock without Pricing - Show items missing prices at the top */}
              {stockWithoutPricing.length > 0 && (
                <Card className="bg-gradient-to-br from-red-50/90 to-orange-50/90 dark:from-red-900/20 dark:to-orange-900/20 backdrop-blur-xl border border-red-200/50 dark:border-red-700/30 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-red-800 dark:text-red-200">
                      <AlertTriangle className="w-5 h-5" />
                      Stock Without Pricing ({stockWithoutPricing.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <p className="text-red-700 dark:text-red-300 text-sm">
                        These items are in stock but have no pricing information in the system.
                      </p>
                      {selectedStore === 'ALL_STORE' && user?.can_access_all_stores && (
                        <div className="mt-3">
                          <Button
                            onClick={() => setShowResolvePricingModal(true)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            size="sm"
                            data-testid="button-resolve-pricing"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Resolve Pricing
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stockWithoutPricing.slice(0, 20).map((item) => {
                        const stockStatus = item.qty === 0 ? 'Out of Stock' : 
                                          item.qty < 10 ? 'Low Stock' : 'In Stock';
                        const statusColor = item.qty === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                                          item.qty < 10 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                                          'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
                        return (
                          <div 
                            key={`${item.stockId}-${item.kodeItem}`}
                            className="flex items-center justify-between p-3 bg-white/60 dark:bg-black/20 rounded-lg border border-blue-200/30 dark:border-blue-700/20"
                            data-testid={`row-stock-${item.kodeItem}`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {item.kodeItem}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {item.serialNumber && item.serialNumber !== '-' ? `Serial: ${item.serialNumber}` : 'No Serial'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Store: {item.kodeGudang} | Qty: {item.qty}
                              </div>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs border-0", statusColor)}
                            >
                              {stockStatus}
                            </Badge>
                          </div>
                        );
                      })}
                      {stockWithoutPricing.length > 20 && (
                        <div className="text-center p-2 text-red-600 dark:text-red-400 text-sm">
                          ... and {stockWithoutPricing.length - 20} more items without pricing
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stores Overview - Show all stores data */}
              {user?.can_access_all_stores && (
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Stores Overview
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchAllStores()}
                        disabled={isRefreshingAllStores}
                        className="h-8 w-8 p-0 bg-white/20 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/40 border-white/30 dark:border-gray-600/30"
                        data-testid="button-refresh-stores"
                      >
                        <RefreshCw className={cn("h-4 w-4", isRefreshingAllStores && "animate-spin")} />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {allStoresOverviewLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="bg-white/40 dark:bg-black/40 rounded-lg p-4 border border-white/20 dark:border-gray-600/30">
                            <Skeleton className="h-4 w-20 mb-2" />
                            <Skeleton className="h-6 w-16 mb-1" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                        ))}
                      </div>
                    ) : allStoresOverview?.stores?.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {allStoresOverview.stores
                          .filter((store: any) => store.kodeGudang && store.namaGudang && store.onHand !== undefined)
                          .map((store: any) => {
                            const totalOnHand = store.onHand || 0;
                            const isLowStock = totalOnHand < 50;
                            const isOutOfStock = totalOnHand === 0;
                            
                            return (
                              <div 
                                key={store.kodeGudang}
                                className="bg-white/40 dark:bg-black/40 rounded-lg p-4 border border-white/20 dark:border-gray-600/30 hover:bg-white/60 dark:hover:bg-black/60 transition-colors cursor-pointer"
                                onClick={() => setSelectedStore(store.kodeGudang)}
                                data-testid={`store-overview-${store.kodeGudang}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={store.namaGudang}>
                                    {store.namaGudang}
                                  </h4>
                                  {isOutOfStock ? (
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  ) : isLowStock ? (
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                  ) : (
                                    <Package className="w-4 h-4 text-green-500" />
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white" data-testid={`text-onhand-${store.kodeGudang}`}>
                                    {totalOnHand.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {store.kodeGudang}
                                  </p>
                                  <Badge 
                                    className={cn(
                                      "text-xs px-2 py-1",
                                      isOutOfStock 
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" 
                                        : isLowStock 
                                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                        : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    )}
                                  >
                                    {isOutOfStock ? "Out" : isLowStock ? "Low" : "OK"}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No store data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {/* Store Overview - Clickable KPIs */}
              <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <Package className="w-5 h-5" />
                    Store Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                      onClick={() => setStockViewType('on-hand')}
                      className={cn(
                        "bg-white/40 dark:bg-black/40 rounded-lg p-4 border border-white/20 dark:border-gray-600/30 text-left hover:bg-white/60 dark:hover:bg-black/60 transition-colors cursor-pointer",
                        stockViewType === 'on-hand' && "ring-2 ring-blue-500"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">On-hand</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-onhand">
                            {stockData.length}
                          </p>
                        </div>
                        <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </button>
                    <button
                      onClick={() => setStockViewType('sold-today')}
                      className={cn(
                        "bg-white/40 dark:bg-black/40 rounded-lg p-4 border border-white/20 dark:border-gray-600/30 text-left hover:bg-white/60 dark:hover:bg-black/60 transition-colors cursor-pointer",
                        stockViewType === 'sold-today' && "ring-2 ring-green-500"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sold Today</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-sold-today">
                            {soldTodayItems.length}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                    </button>
                    <button
                      onClick={() => setStockViewType('low-stock')}
                      className={cn(
                        "bg-white/40 dark:bg-black/40 rounded-lg p-4 border border-white/20 dark:border-gray-600/30 text-left hover:bg-white/60 dark:hover:bg-black/60 transition-colors cursor-pointer",
                        stockViewType === 'low-stock' && "ring-2 ring-orange-500"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Low-Stock</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-low-stock-alerts">
                            {lowStockItems.length}
                          </p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                      </div>
                    </button>
                    <button
                      onClick={() => setStockViewType('inbound')}
                      className={cn(
                        "bg-white/40 dark:bg-black/40 rounded-lg p-4 border border-white/20 dark:border-gray-600/30 text-left hover:bg-white/60 dark:hover:bg-black/60 transition-colors cursor-pointer",
                        stockViewType === 'inbound' && "ring-2 ring-purple-500"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Inbound</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-inbound">
                            {inboundItems.length}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Filtered Stock Views - Show based on selected view */}
              {stockViewType === 'on-hand' && stockData.length > 0 && (
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <Package className="w-5 h-5" />
                      All Stock on Hand ({stockData.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {stockData.map((item) => (
                        <div 
                          key={`${item.stockId}-${item.kodeItem}`}
                          className="flex items-center justify-between p-3 bg-white/60 dark:bg-black/20 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{item.kodeItem}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {item.serialNumber && item.serialNumber !== '-' ? `Serial: ${item.serialNumber}` : 'No Serial'} | Store: {item.kodeGudang}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Qty: {item.qty}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stockViewType === 'sold-today' && soldTodayItems.length > 0 && (
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <DollarSign className="w-5 h-5" />
                      Items Sold Today ({soldTodayItems.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {soldTodayItems.map((item, idx) => (
                        <div 
                          key={`${item.kodeItem}-${idx}`}
                          className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{item.kodeItem}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {item.serialNumber || 'No Serial'}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/40">
                            Sold
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stockViewType === 'low-stock' && lowStockItems.length > 0 && (
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <AlertTriangle className="w-5 h-5" />
                      Low Stock Items ({lowStockItems.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {lowStockItems.map((item) => (
                        <div 
                          key={`${item.stockId}-${item.kodeItem}`}
                          className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{item.kodeItem}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              Store: {item.kodeGudang} | {item.serialNumber || 'No Serial'}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900/40">
                            Only {item.qty} left
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stockViewType === 'inbound' && inboundItems.length > 0 && (
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <TrendingUp className="w-5 h-5" />
                      Inbound Stock ({inboundItems.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {inboundItems.map((item, idx) => (
                        <div 
                          key={`${item.toNumber}-${idx}`}
                          className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{item.namaItem || item.kodeItem}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              Transfer: {item.toNumber} | From: {item.fromStore}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/40">
                            Qty: {item.qty}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Enhanced Stock Movements with Chart Visualization */}
              <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                      <Activity className="w-5 h-5" />
                      Stock Movements Analysis
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Date Range Controls */}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <Input
                          type="date"
                          value={dateRange.from.toISOString().split('T')[0]}
                          onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                          className="w-auto h-8 text-xs"
                          data-testid="input-date-from"
                        />
                        <span className="text-gray-500">to</span>
                        <Input
                          type="date"
                          value={dateRange.to.toISOString().split('T')[0]}
                          onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                          className="w-auto h-8 text-xs"
                          data-testid="input-date-to"
                        />
                      </div>
                      {/* View Toggle */}
                      <div className="flex rounded-lg border border-white/20 dark:border-gray-600/30 p-1">
                        <Button
                          variant={movementsViewType === 'chart' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setMovementsViewType('chart')}
                          className="h-6 px-2 text-xs"
                          data-testid="button-chart-view"
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Chart
                        </Button>
                        <Button
                          variant={movementsViewType === 'table' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setMovementsViewType('table')}
                          className="h-6 px-2 text-xs"
                          data-testid="button-table-view"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Table
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {stockMovementsLoading ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-8 w-full" />
                          </div>
                        ))}
                      </div>
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : chartData.length > 0 ? (
                    <div className="space-y-6">
                      {/* Summary Statistics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/40 dark:bg-black/40 rounded-lg p-3 border border-white/20 dark:border-gray-600/30">
                          <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-green-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Total IN</p>
                              <p className="text-lg font-bold text-green-700 dark:text-green-300" data-testid="text-total-in">
                                {movementsSummary.totalIn.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/40 dark:bg-black/40 rounded-lg p-3 border border-white/20 dark:border-gray-600/30">
                          <div className="flex items-center gap-2">
                            <Download className="w-4 h-4 text-red-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Total OUT</p>
                              <p className="text-lg font-bold text-red-700 dark:text-red-300" data-testid="text-total-out">
                                {movementsSummary.totalOut.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/40 dark:bg-black/40 rounded-lg p-3 border border-white/20 dark:border-gray-600/30">
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`w-4 h-4 ${movementsSummary.netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Net Movement</p>
                              <p className={`text-lg font-bold ${movementsSummary.netMovement >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`} data-testid="text-net-movement">
                                {movementsSummary.netMovement >= 0 ? '+' : ''}{movementsSummary.netMovement.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/40 dark:bg-black/40 rounded-lg p-3 border border-white/20 dark:border-gray-600/30">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Active Days</p>
                              <p className="text-lg font-bold text-blue-700 dark:text-blue-300" data-testid="text-active-days">
                                {movementsSummary.daysWithActivity}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Chart or Table View */}
                      {movementsViewType === 'chart' ? (
                        <div className="h-80">
                          <ChartContainer config={chartConfig}>
                            <ComposedChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis 
                                dataKey="dateFormatted" 
                                className="fill-muted-foreground text-xs"
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis className="fill-muted-foreground text-xs" tick={{ fontSize: 12 }} />
                              <ChartTooltip 
                                content={<ChartTooltipContent />}
                                formatter={(value: any, name: string) => [
                                  `${value}`,
                                  name === 'inCount' ? 'Stock IN' : name === 'outCount' ? 'Stock OUT' : 'Net Movement'
                                ]}
                                labelFormatter={(label: any, payload: any) => {
                                  if (payload && payload[0] && payload[0].payload) {
                                    return payload[0].payload.fullDate;
                                  }
                                  return label;
                                }}
                              />
                              <Bar 
                                dataKey="inCount" 
                                fill="var(--color-inCount)" 
                                name="Stock IN"
                                radius={[2, 2, 0, 0]}
                              />
                              <Bar 
                                dataKey="outCount" 
                                fill="var(--color-outCount)" 
                                name="Stock OUT"
                                radius={[2, 2, 0, 0]}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="netMovement" 
                                stroke="var(--color-netMovement)" 
                                strokeWidth={2}
                                dot={{ fill: "var(--color-netMovement)", strokeWidth: 2, r: 4 }}
                                name="Net Movement"
                              />
                            </ComposedChart>
                          </ChartContainer>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          <div className="grid grid-cols-5 gap-4 p-3 bg-white/20 dark:bg-black/20 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-300">
                            <span>Date</span>
                            <span className="text-green-700 dark:text-green-300">IN</span>
                            <span className="text-red-700 dark:text-red-300">OUT</span>
                            <span className="text-blue-700 dark:text-blue-300">Net</span>
                            <span>Activity</span>
                          </div>
                          {chartData.map((item, index) => (
                            <div key={index} className="grid grid-cols-5 gap-4 p-3 bg-white/40 dark:bg-black/40 rounded-lg border border-white/20 dark:border-gray-600/30 text-sm" data-testid={`row-movement-${index}`}>
                              <span className="text-gray-700 dark:text-gray-300">{item.dateFormatted}</span>
                              <span className="text-green-700 dark:text-green-300 font-medium">+{item.inCount}</span>
                              <span className="text-red-700 dark:text-red-300 font-medium">-{item.outCount}</span>
                              <span className={`font-medium ${item.netMovement >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                {item.netMovement >= 0 ? '+' : ''}{item.netMovement}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {item.inCount > 0 || item.outCount > 0 ? (
                                  <Badge variant="secondary" className="text-xs">
                                    Active
                                  </Badge>
                                ) : (
                                  <span className="text-xs">Idle</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Movement Data</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">No stock movements found for the selected date range.</p>
                      <Button 
                        onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                        variant="outline"
                        size="sm"
                        data-testid="button-reset-dates"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Reset to Last 7 Days
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions - Grouped Together */}
              <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <Plus className="w-5 h-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

                    {/* Quick Pricelist Search - Only show if user has permission */}
                    {hasPermission && hasPermission("pricelist:read") && (
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
                    )}

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
                            {filteredStock.slice(0, 5).map((item: any, index: number) => {
                              const status = getStockStatus(item.qtyOnHand || item.qty || 0);
                              return (
                                <div key={index} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm">
                                  <div className="flex justify-between items-center">
                                    <div className="font-medium">{item.kodeItem}</div>
                                    <Badge className={status.color}>{item.qtyOnHand || item.qty || 0}</Badge>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

                {/* Stock Movement */}
                <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between text-gray-900 dark:text-white">
                      <span>Stock Movement</span>
                      <Package className="w-4 h-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Top Items</span>
                        <span className="font-semibold text-green-700 dark:text-green-300">{stockOverview?.activeStore?.topItems?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Total On-Hand</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{stockOverview?.activeStore?.onHand || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">All Stores</span>
                        <span className="font-semibold text-purple-700 dark:text-purple-300">{stockOverview?.stores?.length || 0}</span>
                      </div>
                      <div className="text-xs text-center text-gray-700 dark:text-gray-300">
                        {stockOverview?.activeStore?.onHand ? '🟢 Stock Available' : '🔴 No Stock Data'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Imports Widget - Live Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Imports Widget */}
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

                {/* Recent Sales Activity */}
                {recentSales.length > 0 && (
                  <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                        <ShoppingCart className="w-5 h-5" />
                        Recent Sales Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {recentSales.slice(0, 8).map((sale, index) => (
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

      {/* Resolve Pricing Modal */}
      <ResolvePricingModal 
        isOpen={showResolvePricingModal} 
        onClose={() => setShowResolvePricingModal(false)} 
        stockWithoutPricing={stockWithoutPricing}
        onPricingResolved={() => {
          // Refresh stock data after pricing is resolved
          queryClient.invalidateQueries({ queryKey: ['/api/stock/without-pricing', selectedStore] });
        }}
      />
    </div>
  );
}