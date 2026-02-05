import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStoreAuth } from "@/hooks/useStoreAuth";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const settlementFormSchema = z.object({
  kodeGudang: z.string().min(1, "Store is required"),
  tanggal: z.string().min(1, "Date is required"),
  cashAwal: z.string().min(1, "Starting cash amount is required"),
  cashAkhir: z.string().min(1, "Ending cash amount is required"),
  variance: z.string().optional().default("0"),
  bazarId: z.string().optional(),
});

type SettlementFormData = z.infer<typeof settlementFormSchema>;

interface Store {
  kodeGudang: string;
  namaGudang: string;
}

interface Bazar {
  bazarId: number;
  bazarName: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'ended';
}

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettlementModal({ isOpen, onClose }: SettlementModalProps) {
  const { toast } = useToast();
  const { user } = useStoreAuth();
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading: storesLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
    retry: false,
  });

  const { data: activeBazars = [] } = useQuery<Bazar[]>({
    queryKey: ["/api/bazars/active"],
    retry: false,
  });

  const form = useForm<SettlementFormData>({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: {
      kodeGudang: user?.store_id || "",
      tanggal: new Date().toISOString().split('T')[0],
      cashAwal: "",
      cashAkhir: "",
      variance: "0",
      bazarId: "",
    },
  });

  const watchCashAwal = form.watch("cashAwal");
  const watchCashAkhir = form.watch("cashAkhir");

  useEffect(() => {
    if (watchCashAwal && watchCashAkhir) {
      const awal = parseFloat(watchCashAwal) || 0;
      const akhir = parseFloat(watchCashAkhir) || 0;
      const variance = akhir - awal;
      form.setValue("variance", variance.toString());
    }
  }, [watchCashAwal, watchCashAkhir, form]);

  const createSettlementMutation = useMutation({
    mutationFn: async (data: SettlementFormData) => {
      const response = await apiRequest('POST', '/api/settlements', {
        kodeGudang: data.kodeGudang,
        tanggal: data.tanggal,
        cashAwal: data.cashAwal,
        cashAkhir: data.cashAkhir,
        variance: data.variance,
        bazarId: data.bazarId ? parseInt(data.bazarId) : null,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settlement Created",
        description: "Settlement has been created successfully",
      });
      
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/settlements'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Settlement Creation Failed",
        description: error.message || "Failed to create settlement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettlementFormData) => {
    createSettlementMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const availableStores = user?.can_access_all_stores 
    ? stores 
    : stores.filter(store => store.kodeGudang === user?.store_id);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Settlement</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="kodeGudang"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-store">
                        <SelectValue placeholder="Select a store" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {storesLoading ? (
                        <SelectItem value="" disabled>Loading stores...</SelectItem>
                      ) : availableStores.length === 0 ? (
                        <SelectItem value="" disabled>No stores available</SelectItem>
                      ) : (
                        availableStores.map((store) => (
                          <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                            {store.namaGudang} ({store.kodeGudang})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeBazars.length > 0 && (
              <FormField
                control={form.control}
                name="bazarId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Bazar Event 
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                        Optional
                      </Badge>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bazar">
                          <SelectValue placeholder="Not a bazar settlement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Not a bazar settlement</SelectItem>
                        {activeBazars.map((bazar) => (
                          <SelectItem key={bazar.bazarId} value={bazar.bazarId.toString()}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              {bazar.bazarName} - {bazar.location}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Link this settlement to an active bazar event for tracking
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="tanggal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      data-testid="input-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cashAwal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Starting Cash Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      data-testid="input-cash-start"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cashAkhir"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ending Cash Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      data-testid="input-cash-end"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="variance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variance (Auto-calculated)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800"
                      data-testid="input-variance"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createSettlementMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSettlementMutation.isPending}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                data-testid="button-create-settlement"
              >
                {createSettlementMutation.isPending ? 'Creating...' : 'Create Settlement'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
