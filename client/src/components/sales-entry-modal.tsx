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
  kodeItem: z.string().min(1, "Item code is required"),
  serialNumber: z.string().optional(),
  discountId: z.string().optional(),
  discByAmount: z.string().optional(),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  notes: z.string().optional(),
  preOrder: z.boolean().default(false),
  normalPrice: z.string(),
  unitPrice: z.string(),
  finalPrice: z.string(),
});

type SalesFormData = z.infer<typeof salesFormSchema>;

interface SalesEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore?: string;
}

interface PriceQuote {
  normal_price: number;
  unit_price: number;
  discount_amount: number;
  final_price: number;
  source: string;
}

export function SalesEntryModal({ isOpen, onClose, selectedStore }: SalesEntryModalProps) {
  const { toast } = useToast();
  const { user } = useStoreAuth();
  const queryClient = useQueryClient();
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      kodeGudang: selectedStore || "",
      tanggal: new Date().toISOString().split('T')[0],
      kodeItem: "",
      serialNumber: "",
      discountId: "",
      discByAmount: "",
      paymentMethodId: "",
      notes: "",
      preOrder: false,
      normalPrice: "0",
      unitPrice: "0", 
      finalPrice: "0",
    },
  });

  // Update form when selectedStore changes
  useEffect(() => {
    if (selectedStore) {
      form.setValue('kodeGudang', selectedStore);
    }
  }, [selectedStore, form]);

  // Get stores
  const { data: stores } = useQuery({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get payment methods
  const { data: paymentMethods } = useQuery({
    queryKey: ["/api/payment-methods"],
    retry: false,
  });

  // Get discounts
  const { data: discounts } = useQuery({
    queryKey: ["/api/discounts"],
    retry: false,
  });

  // Price quote mutation
  const priceQuoteMutation = useMutation({
    mutationFn: async (params: any) => {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/api/price/quote?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch price quote');
      return response.json();
    },
    onSuccess: (data: PriceQuote) => {
      setPriceQuote(data);
      form.setValue('normalPrice', data.normal_price.toString());
      form.setValue('unitPrice', data.unit_price.toString());
      form.setValue('finalPrice', data.final_price.toString());
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to get price quote",
        variant: "destructive",
      });
    },
  });

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
      form.reset();
      setPriceQuote(null);
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
          window.location.href = "/api/login";
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
    const submitData = {
      ...data,
      discByAmount: data.discByAmount ? parseFloat(data.discByAmount) : null,
      normalPrice: parseFloat(data.normalPrice),
      unitPrice: parseFloat(data.unitPrice),
      finalPrice: parseFloat(data.finalPrice),
      paymentMethodId: parseInt(data.paymentMethodId),
      discountId: data.discountId ? parseInt(data.discountId) : null,
    };

    createSaleMutation.mutate(submitData);
  };

  const handleItemCodeBlur = () => {
    const kodeItem = form.getValues('kodeItem');
    const serialNumber = form.getValues('serialNumber');
    const discountId = form.getValues('discountId');
    const discByAmount = form.getValues('discByAmount');

    if (kodeItem) {
      priceQuoteMutation.mutate({
        kode_item: kodeItem,
        serial_number: serialNumber || undefined,
        discount_id: discountId || undefined,
        disc_by_amount: discByAmount || undefined,
      });
    }
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
                          {stores?.map((store: any) => (
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
                            {stores?.find((store: any) => store.kodeGudang === field.value)?.namaGudang || field.value}
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

            {/* Item Code and Serial Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="kodeItem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter item code"
                        {...field}
                        onBlur={handleItemCodeBlur}
                        data-testid="input-item-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter serial number"
                        {...field}
                        data-testid="input-serial-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Price Resolution Display */}
            {priceQuote && (
              <Card className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Price Resolution</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Normal Price:</span>
                      <p className="font-semibold text-gray-900 dark:text-white" data-testid="text-normal-price">
                        Rp {priceQuote.normal_price.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Unit Price:</span>
                      <p className="font-semibold text-gray-900 dark:text-white" data-testid="text-unit-price">
                        Rp {priceQuote.unit_price.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Final Price:</span>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-final-price">
                        Rp {priceQuote.final_price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Method and Discount */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="paymentMethodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue placeholder="Select Payment Method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods?.map((method: any) => (
                          <SelectItem key={method.paymentMethodId} value={method.paymentMethodId.toString()}>
                            {method.methodName}
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
                name="discByAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        data-testid="input-discount-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
