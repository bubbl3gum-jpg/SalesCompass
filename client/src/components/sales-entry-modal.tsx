import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { isUnauthorizedError } from "@/lib/authUtils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

const salesFormSchema = z.object({
  kodeGudang: z.string()
    .min(1, "Store is required")
    .refine((val) => val !== 'ALL_STORE', {
      message: "Please select a specific store. Sales cannot be recorded for 'ALL_STORE'."
    }),
  tanggal: z.string().min(1, "Date is required"),
  serialNumber: z.string().optional(),
  kodeItem: z.string().min(1, "Item code is required"),
  namaItem: z.string().min(1, "Item name is required"),
  quantity: z.string().min(1, "Quantity is required"),
  normalPrice: z.string(),
  discountType: z.string().optional(),
  finalPrice: z.string(),
  paymentMethod: z.string().min(1, "Payment method is required"),
  notes: z.string().optional(),
});

type SalesFormData = z.infer<typeof salesFormSchema>;

interface SalesEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore?: string;
  editingSale?: any;
}

interface ItemLookup {
  kodeItem: string;
  namaItem: string;
  normalPrice: number;
  sp?: number;
  availableQuantity: number;
  kelompok?: string;
  family?: string;
  spDiscountPercentage?: number;
}

interface DiscountOption {
  discountId: number;
  discountName: string | null;
  discountType: string | null;
  discountAmount: string | null;
  startFrom?: string;
  endAt?: string;
}

export function SalesEntryModal({ isOpen, onClose, selectedStore, editingSale }: SalesEntryModalProps) {
  const { toast } = useToast();
  const { user, hasPermission } = useStoreAuth();
  const queryClient = useQueryClient();
  
  // State for the search and selection
  const [searchMode, setSearchMode] = useState<'serial' | 'item' | 'manual'>('serial');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<ItemLookup[]>([]);
  const [selectedItemData, setSelectedItemData] = useState<ItemLookup | null>(null);
  const [availableQuantities, setAvailableQuantities] = useState<number[]>([]);
  const [applicableDiscounts, setApplicableDiscounts] = useState<DiscountOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Fetch payment methods from database
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['/api/edc'],
    enabled: isOpen,
  });

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: editingSale ? {
      kodeGudang: editingSale.kodeGudang || selectedStore || "",
      tanggal: editingSale.tanggal || new Date().toISOString().split('T')[0],
      serialNumber: editingSale.serialNumber || "",
      kodeItem: editingSale.kodeItem || "",
      namaItem: editingSale.namaItem || "",
      quantity: "1", // Default to 1 for editing
      normalPrice: editingSale.finalPrice?.toString() || "0",
      discountType: editingSale.discountType || "",
      finalPrice: editingSale.finalPrice?.toString() || "0",
      paymentMethod: editingSale.paymentMethod || "Cash",
      notes: editingSale.notes || "",
    } : {
      kodeGudang: selectedStore || "",
      tanggal: new Date().toISOString().split('T')[0],
      serialNumber: "",
      kodeItem: "",
      namaItem: "",
      quantity: "",
      normalPrice: "0",
      discountType: "",
      finalPrice: "0",
      paymentMethod: "Cash",
      notes: "",
    },
  });

  // Update form when selectedStore changes
  useEffect(() => {
    if (selectedStore) {
      form.setValue('kodeGudang', selectedStore);
    }
  }, [selectedStore, form]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingSale) {
        // When editing, populate form with existing data
        form.reset({
          kodeGudang: editingSale.kodeGudang || selectedStore || "",
          tanggal: editingSale.tanggal || new Date().toISOString().split('T')[0],
          serialNumber: editingSale.serialNumber || "",
          kodeItem: editingSale.kodeItem || "",
          namaItem: editingSale.namaItem || "",
          quantity: editingSale.quantity?.toString() || "1",
          normalPrice: editingSale.normalPrice?.toString() || editingSale.finalPrice?.toString() || "0",
          discountType: editingSale.discountType || "",
          finalPrice: editingSale.finalPrice?.toString() || "0",
          paymentMethod: editingSale.paymentMethod || "Cash",
          notes: editingSale.notes || "",
        });
        // Set item data if available
        if (editingSale.kodeItem) {
          setSelectedItemData({
            kodeItem: editingSale.kodeItem,
            namaItem: editingSale.namaItem,
            normalPrice: editingSale.normalPrice || editingSale.finalPrice || 0,
            sp: 0,
            availableQuantity: 999,
          });
        }
      } else {
        // When creating new, reset to empty form
        form.reset({
          kodeGudang: selectedStore || "",
          tanggal: new Date().toISOString().split('T')[0],
          serialNumber: "",
          kodeItem: "",
          namaItem: "",
          quantity: "",
          normalPrice: "0",
          discountType: "",
          finalPrice: "0",
          paymentMethod: "Cash",
          notes: "",
        });
        setItemSearchResults([]);
        setSelectedItemData(null);
        setAvailableQuantities([]);
        setApplicableDiscounts([]);
        setSearchQuery('');
        setSearchMode('serial');
      }
    }
  }, [isOpen, selectedStore, editingSale, form]);

  // Get stores
  const { data: stores } = useQuery({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Ensure stores is an array
  const storesArray = Array.isArray(stores) ? stores : [];

  // Get all discounts for filtering
  const { data: allDiscounts } = useQuery({
    queryKey: ["/api/discounts"],
    enabled: hasPermission ? hasPermission("discount:read") : false,
    retry: false,
  });

  // Unified search function - now searches actual store inventory
  const performSearch = async () => {
    if (!searchQuery.trim() || !form.getValues('kodeGudang')) return;
    
    setIsSearching(true);
    setItemSearchResults([]);
    
    try {
      const store = form.getValues('kodeGudang');
      const searchType = searchMode;
      
      // Use the new inventory search endpoint with proper authentication
      const response = await apiRequest(
        'GET',
        `/api/inventory/search?store=${encodeURIComponent(store)}&query=${encodeURIComponent(searchQuery)}&searchType=${searchType}`
      );

      const matchingItems: ItemLookup[] = await response.json();

      if (matchingItems.length === 0) {
        toast({
          title: "No Items Found",
          description: `No items found matching "${searchQuery}" in store inventory`,
          variant: "destructive",
        });
      } else {
        setItemSearchResults(matchingItems);
        
        // Auto-select if only one match
        if (matchingItems.length === 1) {
          selectItem(matchingItems[0]);
        }
      }
      
    } catch (error) {
      console.error('Error searching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to search store inventory. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Select an item and auto-fill form
  const selectItem = (item: ItemLookup) => {
    setSelectedItemData(item);
    form.setValue('kodeItem', item.kodeItem);
    form.setValue('namaItem', item.namaItem);
    form.setValue('normalPrice', item.normalPrice.toString());
    form.setValue('serialNumber', searchQuery);
    
    // Set available quantities based on actual inventory
    const maxQty = item.availableQuantity || 1;
    setAvailableQuantities(Array.from({ length: maxQty }, (_, i) => i + 1));
    
    // Filter applicable discounts and add SP discount if available
    let discountOptions: DiscountOption[] = [];
    
    if (allDiscounts && Array.isArray(allDiscounts)) {
      const regularDiscounts = allDiscounts.filter((discount: any) => {
        // Check if discount is active
        const now = new Date();
        const startDate = discount.startFrom ? new Date(discount.startFrom) : null;
        const endDate = discount.endAt ? new Date(discount.endAt) : null;
        
        if (startDate && now < startDate) return false;
        if (endDate && now > endDate) return false;
        
        return true;
      });
      
      discountOptions = regularDiscounts || [];
    }

    // Add SP as a discount option if it exists and is lower than normal price
    if (item.sp && item.spDiscountPercentage && item.spDiscountPercentage > 0) {
      const spDiscount: DiscountOption = {
        discountId: -1, // Special ID for SP discount
        discountName: `Special Price (SP)`,
        discountType: 'percentage',
        discountAmount: item.spDiscountPercentage.toString(),
      };
      discountOptions.unshift(spDiscount); // Add at the beginning
    }
    
    setApplicableDiscounts(discountOptions);
    
    // Default quantity to 1
    form.setValue('quantity', '1');
    calculateFinalPrice('1', item.normalPrice, '');
  };

  // Calculate final price based on quantity and discount
  const calculateFinalPrice = (quantity: string, normalPrice: number, discountType: string) => {
    const qty = parseInt(quantity) || 1; // Default to 1 if 0
    let total = qty * normalPrice;
    
    console.log('calculateFinalPrice called:', { quantity, normalPrice, discountType, qty, total });
    console.log('Available discounts:', applicableDiscounts);
    
    if (discountType && discountType !== '' && discountType !== 'none' && applicableDiscounts.length > 0) {
      const discount = applicableDiscounts.find(d => d.discountId.toString() === discountType);
      console.log('Found discount:', discount);
      
      if (discount && discount.discountAmount) {
        const discountValue = parseFloat(discount.discountAmount);
        
        if (discount.discountType === 'percentage' && discountValue > 0) {
          const discountAmount = total * (discountValue / 100);
          total = total - discountAmount;
          console.log('Applied percentage discount:', { percentage: discountValue, discountAmount, newTotal: total });
        } else if (discount.discountType === 'amount' && discountValue > 0) {
          const originalTotal = total;
          total = Math.max(0, total - discountValue);
          console.log('Applied amount discount:', { amount: discountValue, originalTotal, newTotal: total });
        }
      } else {
        console.log('Discount not found or no discountAmount for ID:', discountType);
      }
    } else {
      console.log('No discount applied - discountType:', discountType);
    }
    
    console.log('Final calculated total:', total);
    form.setValue('finalPrice', total.toString());
    
    // Force form to trigger re-render
    form.trigger('finalPrice');
  };

  // Handle quantity change
  const handleQuantityChange = (value: string) => {
    form.setValue('quantity', value);
    if (selectedItemData) {
      calculateFinalPrice(value, selectedItemData.normalPrice, form.getValues('discountType') || '');
    }
  };

  // Handle discount change
  const handleDiscountChange = (value: string) => {
    console.log('handleDiscountChange called with value:', value);
    const discountValue = value === 'none' ? '' : value;
    console.log('Setting discount value to:', discountValue);
    form.setValue('discountType', discountValue);
    
    // Force trigger the form to update and recalculate
    const currentQuantity = form.getValues('quantity') || '1';
    const currentNormalPrice = parseFloat(form.getValues('normalPrice')) || (selectedItemData?.normalPrice || 0);
    
    console.log('Current form values:', {
      quantity: currentQuantity,
      normalPrice: currentNormalPrice,
      discountValue
    });
    
    calculateFinalPrice(currentQuantity, currentNormalPrice, discountValue);
  };

  // Create or Update sale mutation
  const saveSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSale) {
        return apiRequest('PUT', `/api/sales/${editingSale.penjualanId}`, data);
      } else {
        return apiRequest('POST', '/api/sales', data);
      }
    },
    onSuccess: async (response) => {
      const data = await response.json();
      const storeCode = form.getValues('kodeGudang');
      
      toast({
        title: "Success",
        description: "Sale recorded successfully",
      });
      
      // Invalidate specific query keys to refresh dashboard and stock data
      // Dashboard metrics
      queryClient.invalidateQueries({ 
        queryKey: ["/api/dashboard/metrics", storeCode] 
      });
      
      // Sales data for both specific store and general sales queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/sales", storeCode] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/sales"] 
      });
      
      // Stock overview data
      queryClient.invalidateQueries({ 
        queryKey: ['stores', 'stock', 'overview'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/stock/onhand", storeCode] 
      });
      
      // Inventory search and stock movements
      queryClient.invalidateQueries({ 
        queryKey: ['stock', 'movements'] 
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/inventory' ||
          query.queryKey[0] === '/api/stock' ||
          query.queryKey[0] === 'dashboard' ||
          query.queryKey[0] === 'sales'
      });
      
      onClose();
    },
    onError: (error: any) => {
      console.error('Sale creation error:', error);
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        return;
      }
      
      const errorMessage = error?.message || "Failed to record sale";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: SalesFormData) => {
    // Additional validation to prevent ALL_STORE sales
    if (data.kodeGudang === 'ALL_STORE') {
      toast({
        title: "Invalid Store Selection",
        description: "Sales cannot be recorded for 'ALL_STORE'. Please select a specific store from the list.",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...data,
      quantity: parseInt(data.quantity),
      normalPrice: parseFloat(data.normalPrice),
      finalPrice: parseFloat(data.finalPrice),
      discountType: data.discountType || null,
    };
    
    saveSaleMutation.mutate(submitData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {editingSale ? 'Edit Sale Transaction' : 'New Sale Entry'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Store and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="kodeGudang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store</FormLabel>
                    {user?.can_access_all_stores ? (
                      // All-store users: Show dropdown selector
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-store">
                            <SelectValue placeholder="Select Store" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {storesArray
                            ?.filter((store: any) => 
                              store.kodeGudang && 
                              store.namaGudang && 
                              store.kodeGudang.trim() !== '' && 
                              store.namaGudang.trim() !== '' &&
                              store.kodeGudang !== 'ALL_STORE' // Filter out ALL_STORE
                            )
                            .map((store: any) => (
                            <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                              {store.namaGudang}
                            </SelectItem>
                          ))}
                          {/* Show helpful message if no real stores available */}
                          {storesArray?.filter((store: any) => 
                            store.kodeGudang && 
                            store.namaGudang && 
                            store.kodeGudang.trim() !== '' && 
                            store.namaGudang.trim() !== '' &&
                            store.kodeGudang !== 'ALL_STORE'
                          ).length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No stores available for sales entry
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      // Individual store users: Show fixed store display
                      <FormControl>
                        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                          <span className="text-foreground">
                            {storesArray?.find((store: any) => store.kodeGudang === field.value)?.namaGudang || field.value}
                          </span>
                        </div>
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tanggal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Search Section */}
            <Card>
              <CardContent className="pt-6">
                <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="serial">Search by Serial Number</TabsTrigger>
                    <TabsTrigger value="item">Search by Item Details</TabsTrigger>
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="serial" className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter serial number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                        disabled={isSearching}
                        data-testid="input-serial-search"
                      />
                      <Button 
                        type="button"
                        onClick={performSearch}
                        disabled={isSearching || !searchQuery.trim()}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="item" className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search by item code, name, family, or kelompok..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                        disabled={isSearching}
                        data-testid="input-item-search"
                      />
                      <Button 
                        type="button"
                        onClick={performSearch}
                        disabled={isSearching || !searchQuery.trim()}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="manual" className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter item details manually below
                    </p>
                  </TabsContent>
                </Tabs>

                {/* Search Results */}
                {itemSearchResults.length > 1 && (
                  <div className="mt-4 space-y-2">
                    <FormLabel>Select Item from Search Results</FormLabel>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {itemSearchResults.map((item) => (
                        <div
                          key={item.kodeItem}
                          className="p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => selectItem(item)}
                        >
                          <div className="font-medium">{item.kodeItem} - {item.namaItem}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.kelompok && `Kelompok: ${item.kelompok}`}
                            {item.family && ` | Family: ${item.family}`}
                            {` | Price: Rp ${item.normalPrice.toLocaleString()}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Item Details - Always visible for manual entry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="kodeItem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly={searchMode !== 'manual' && !!selectedItemData}
                        className={searchMode !== 'manual' && selectedItemData ? "bg-gray-50 dark:bg-gray-800" : ""}
                        data-testid="input-item-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="namaItem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly={searchMode !== 'manual' && !!selectedItemData}
                        className={searchMode !== 'manual' && selectedItemData ? "bg-gray-50 dark:bg-gray-800" : ""}
                        data-testid="input-item-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional item info if available */}
            {selectedItemData && (selectedItemData.kelompok || selectedItemData.family) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedItemData.kelompok && (
                  <div>
                    <FormLabel>Kelompok</FormLabel>
                    <Input
                      value={selectedItemData.kelompok}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  </div>
                )}
                {selectedItemData.family && (
                  <div>
                    <FormLabel>Family</FormLabel>
                    <Input
                      value={selectedItemData.family}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Quantity and Price */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    {availableQuantities.length > 0 ? (
                      <Select onValueChange={handleQuantityChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-quantity">
                            <SelectValue placeholder="Select quantity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableQuantities.map((qty) => (
                            <SelectItem key={qty} value={qty.toString()}>
                              {qty}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          min="1"
                          onChange={(e) => handleQuantityChange(e.target.value)}
                          data-testid="input-quantity" 
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="normalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Normal Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        readOnly={searchMode !== 'manual' && !!selectedItemData}
                        className={searchMode !== 'manual' && selectedItemData ? "bg-gray-50 dark:bg-gray-800" : ""}
                        data-testid="input-normal-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="finalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        readOnly
                        className="bg-gray-50 dark:bg-gray-800 font-semibold"
                        data-testid="input-final-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Discount Selection */}
            {applicableDiscounts.length > 0 && (
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apply Discount (Optional)</FormLabel>
                    <Select onValueChange={handleDiscountChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-discount">
                          <SelectValue placeholder="No discount" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No discount</SelectItem>
                        {applicableDiscounts.map((discount) => (
                          <SelectItem key={discount.discountId} value={discount.discountId.toString()}>
                            {discount.discountName || 'Discount'}
                            {discount.discountType === 'percentage' && discount.discountAmount ? 
                              ` - ${discount.discountAmount}%` : 
                              discount.discountType === 'amount' && discount.discountAmount ? 
                                ` - Rp ${parseFloat(discount.discountAmount).toLocaleString()}` : 
                                ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      {Array.isArray(paymentMethods) && paymentMethods.map((method: any) => (
                        <SelectItem key={method.edcId} value={method.namaEdc}>
                          {method.namaEdc} {method.jenisEdc ? `(${method.jenisEdc})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes..."
                      className="min-h-[80px]"
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saveSaleMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveSaleMutation.isPending || !form.getValues('kodeItem')}
                data-testid="button-submit"
              >
                {saveSaleMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Recording...
                  </>
                ) : (
                  editingSale ? 'Update Sale' : 'Record Sale'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}