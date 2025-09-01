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

const salesFormSchema = z.object({
  kodeGudang: z.string().min(1, "Store is required"),
  tanggal: z.string().min(1, "Date is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  kodeItem: z.string().min(1, "Item code is required"),
  namaItem: z.string().min(1, "Item name is required"),
  quantity: z.string().min(1, "Quantity is required"),
  normalPrice: z.string(),
  discountType: z.string().optional(),
  finalPrice: z.string(),
  notes: z.string().optional(),
});

type SalesFormData = z.infer<typeof salesFormSchema>;

interface SalesEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore?: string;
}

interface ItemLookup {
  kodeItem: string;
  namaItem: string;
  normalPrice: number;
  sp?: number;
  availableQuantity: number;
}

interface DiscountOption {
  discountId: number;
  discountName: string;
  discountType: string;
  percentage?: number;
  amount?: number;
}

export function SalesEntryModal({ isOpen, onClose, selectedStore }: SalesEntryModalProps) {
  const { toast } = useToast();
  const { user, hasPermission } = useStoreAuth();
  const queryClient = useQueryClient();
  
  // State for the new flow
  const [itemOptions, setItemOptions] = useState<ItemLookup[]>([]);
  const [selectedItemData, setSelectedItemData] = useState<ItemLookup | null>(null);
  const [availableQuantities, setAvailableQuantities] = useState<number[]>([]);
  const [applicableDiscounts, setApplicableDiscounts] = useState<DiscountOption[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      kodeGudang: selectedStore || "",
      tanggal: new Date().toISOString().split('T')[0],
      serialNumber: "",
      kodeItem: "",
      namaItem: "",
      quantity: "",
      normalPrice: "0",
      discountType: "",
      finalPrice: "0",
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
        notes: "",
      });
      setItemOptions([]);
      setSelectedItemData(null);
      setAvailableQuantities([]);
      setApplicableDiscounts([]);
    }
  }, [isOpen, selectedStore, form]);

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

  // Serial number lookup function
  const lookupItemsBySerial = async (serialNumber: string, storeCode: string) => {
    if (!serialNumber.trim() || !storeCode) return;
    
    setIsLoadingItems(true);
    try {
      // Get items with this serial number from reference sheet
      const referenceResponse = await fetch(`/api/reference-sheets?search=${encodeURIComponent(serialNumber)}`);
      if (!referenceResponse.ok) throw new Error('Failed to lookup items');
      
      const referenceItems = await referenceResponse.json();
      const matchingItems = referenceItems.filter((item: any) => 
        item.sn === serialNumber || item.kodeItem?.includes(serialNumber)
      );

      if (matchingItems.length === 0) {
        toast({
          title: "Item Not Found",
          description: "No items found with this serial number",
          variant: "destructive",
        });
        return;
      }

      // Get price information
      const priceResponse = await fetch(`/api/pricelist`);
      const priceList = priceResponse.ok ? await priceResponse.json() : [];

      const itemsWithStock = matchingItems.map((item: any) => {
        const priceItem = priceList.find((price: any) => 
          price.kodeItem === item.kodeItem || price.sn === serialNumber
        );

        return {
          kodeItem: item.kodeItem,
          namaItem: item.namaItem,
          normalPrice: priceItem?.normalPrice || 0,
          sp: priceItem?.sp,
          availableQuantity: 1, // Default to 1 since we're using transfers-based stock tracking
        };
      });

      if (itemsWithStock.length === 0) {
        toast({
          title: "No Stock Available",
          description: "No stock available for items with this serial number",
          variant: "destructive",
        });
        return;
      }

      setItemOptions(itemsWithStock);
      
      // If only one item, auto-select it
      if (itemsWithStock.length === 1) {
        selectItem(itemsWithStock[0]);
      }
      
    } catch (error) {
      console.error('Error looking up items:', error);
      toast({
        title: "Error",
        description: "Failed to lookup items",
        variant: "destructive",
      });
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Select an item and auto-fill form
  const selectItem = (item: ItemLookup) => {
    setSelectedItemData(item);
    form.setValue('kodeItem', item.kodeItem);
    form.setValue('namaItem', item.namaItem);
    form.setValue('normalPrice', item.normalPrice.toString());
    form.setValue('finalPrice', item.normalPrice.toString()); // Default to normal price
    
    // Generate quantity options (1 to available quantity)
    const quantities = Array.from({ length: item.availableQuantity }, (_, i) => i + 1);
    setAvailableQuantities(quantities);
    
    // Load applicable discounts for this item/store
    loadApplicableDiscounts(item.kodeItem, form.getValues('kodeGudang'));
  };

  // Load applicable discounts
  const loadApplicableDiscounts = (kodeItem: string, storeCode: string) => {
    if (!hasPermission || !hasPermission("discount:read") || !allDiscounts || !Array.isArray(allDiscounts)) {
      setApplicableDiscounts([]);
      return;
    }

    // For now, show all discounts - in a real system, you'd filter by store/product
    const discountOptions = allDiscounts.map((discount: any) => ({
      discountId: discount.discountId,
      discountName: discount.discountName || `Discount ${discount.discountId}`,
      discountType: discount.discountType || '0',
      percentage: parseFloat(discount.discountType || '0'),
    }));
    
    setApplicableDiscounts(discountOptions);
  };

  // Calculate final price based on discount selection
  const calculateFinalPrice = (discountType: string) => {
    if (!selectedItemData) return;
    
    let finalPrice = selectedItemData.normalPrice;
    
    if (discountType === 'SP' && selectedItemData.sp) {
      // Use SP price
      finalPrice = selectedItemData.sp;
    } else if (discountType && discountType !== 'SP') {
      // Apply percentage discount
      const discountPercent = parseFloat(discountType) || 0;
      finalPrice = selectedItemData.normalPrice * (1 - discountPercent / 100);
    }
    
    form.setValue('finalPrice', finalPrice.toString());
  };

  // Sales creation mutation
  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/sales', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sale recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      onClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to create sale",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SalesFormData) => {
    if (!selectedItemData) {
      toast({
        title: "Error",
        description: "Please select an item first",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      kodeGudang: data.kodeGudang,
      tanggal: data.tanggal,
      kodeItem: data.kodeItem,
      serialNumber: data.serialNumber,
      quantity: parseInt(data.quantity),
      normalPrice: parseFloat(data.normalPrice),
      finalPrice: parseFloat(data.finalPrice),
      discountType: data.discountType || null,
      notes: data.notes || null,
      paymentMethodId: 1, // Default payment method - adjust as needed
    };

    createSaleMutation.mutate(submitData);
  };

  // Handle serial number input
  const handleSerialNumberChange = (serialNumber: string) => {
    form.setValue('serialNumber', serialNumber);
    
    // Clear previous selections
    setItemOptions([]);
    setSelectedItemData(null);
    setAvailableQuantities([]);
    setApplicableDiscounts([]);
    form.setValue('kodeItem', '');
    form.setValue('namaItem', '');
    form.setValue('quantity', '');
    form.setValue('normalPrice', '0');
    form.setValue('finalPrice', '0');
    form.setValue('discountType', '');
    
    // Lookup items if serial number is provided
    if (serialNumber.trim() && form.getValues('kodeGudang')) {
      lookupItemsBySerial(serialNumber, form.getValues('kodeGudang'));
    }
  };

  // Handle discount type change
  const handleDiscountChange = (discountType: string) => {
    form.setValue('discountType', discountType);
    calculateFinalPrice(discountType);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            New Sale Entry
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
                          <SelectItem value="ALL_STORE">All Stores</SelectItem>
                          {storesArray?.map((store: any) => (
                            <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                              {store.namaGudang}
                            </SelectItem>
                          ))}
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

            {/* Serial Number - First Field */}
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter serial number"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleSerialNumberChange(e.target.value);
                      }}
                      disabled={isLoadingItems}
                      data-testid="input-serial-number"
                    />
                  </FormControl>
                  {isLoadingItems && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Looking up items...
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Item Selection - Show when multiple items found */}
            {itemOptions.length > 1 && (
              <FormField
                control={form.control}
                name="kodeItem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Item</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        const selectedItem = itemOptions.find(item => item.kodeItem === value);
                        if (selectedItem) {
                          selectItem(selectedItem);
                        }
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-item">
                          <SelectValue placeholder="Choose the correct item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {itemOptions.map((item) => (
                          <SelectItem key={item.kodeItem} value={item.kodeItem}>
                            {item.kodeItem} - {item.namaItem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Auto-filled Item Information */}
            {selectedItemData && (
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
                          readOnly
                          className="bg-gray-50 dark:bg-gray-800"
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
                          readOnly
                          className="bg-gray-50 dark:bg-gray-800"
                          data-testid="input-item-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Quantity and Normal Price */}
            {selectedItemData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-quantity">
                            <SelectValue placeholder="Select quantity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableQuantities.map((qty) => (
                            <SelectItem key={qty} value={qty.toString()}>
                              {qty} {qty === 1 ? 'unit' : 'units'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          {...field}
                          readOnly
                          className="bg-gray-50 dark:bg-gray-800"
                          data-testid="input-normal-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Discount Type and Final Price */}
            {selectedItemData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select onValueChange={handleDiscountChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue placeholder="No discount" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No discount</SelectItem>
                          {selectedItemData.sp && (
                            <SelectItem value="SP">SP Price</SelectItem>
                          )}
                          {applicableDiscounts.map((discount) => (
                            <SelectItem key={discount.discountId} value={discount.discountType}>
                              {discount.discountName} ({discount.percentage}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          {...field}
                          readOnly
                          className="bg-green-50 dark:bg-green-900/20 font-semibold"
                          data-testid="input-final-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Selected Item Display */}
            {selectedItemData && (
              <Card className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Selected Item Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Normal Price:</span>
                      <p className="font-semibold text-gray-900 dark:text-white" data-testid="text-normal-price-display">
                        Rp {selectedItemData.normalPrice.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Available Stock:</span>
                      <p className="font-semibold text-gray-900 dark:text-white" data-testid="text-available-stock">
                        {selectedItemData.availableQuantity} units
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Final Price:</span>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-final-price-display">
                        Rp {parseFloat(form.getValues('finalPrice') || '0').toLocaleString()}
                      </p>
                    </div>
                    {selectedItemData.sp && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">SP Price:</span>
                        <p className="font-semibold text-purple-600 dark:text-purple-400">
                          Rp {selectedItemData.sp.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Add any additional notes..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                disabled={createSaleMutation.isPending}
                data-testid="button-record-sale"
              >
                {createSaleMutation.isPending ? "Recording..." : "Record Sale"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
