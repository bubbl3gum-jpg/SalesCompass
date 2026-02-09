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
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, CreditCard } from "lucide-react";

const settlementFormSchema = z.object({
  settlementType: z.enum(["store", "bazar"]),
  kodeGudang: z.string().optional(),
  bazarId: z.string().optional(),
  tanggal: z.string().min(1, "Date is required"),
  cashAwal: z.string().min(1, "Starting cash amount is required"),
  cashAkhir: z.string().min(1, "Ending cash amount is required"),
  variance: z.string().optional().default("0"),
}).refine((data) => {
  if (!data.kodeGudang) {
    return false;
  }
  return true;
}, {
  message: "Please select a store or bazar",
  path: ["kodeGudang"],
});

type SettlementFormData = z.infer<typeof settlementFormSchema>;

interface Store {
  kodeGudang: string;
  namaGudang: string;
  storeCategory?: string | null;
}

interface Edc {
  edcId: number;
  namaEdc: string;
  jenisEdc: string;
}

interface EdcEntry {
  edcId: string;
  amount: string;
}

interface Settlement {
  settlementId: number;
  kodeGudang: string;
  tanggal: string;
  cashAwal: string;
  cashAkhir: string;
  variance: string;
  bazarId: number | null;
}

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlement?: Settlement | null;
}

interface EdcSettlement {
  edcSettlementId: number;
  settlementId: number;
  storeEdcId: number;
  settlementValue: string;
}

export function SettlementModal({ isOpen, onClose, settlement }: SettlementModalProps) {
  const { toast } = useToast();
  const { user } = useStoreAuth();
  const queryClient = useQueryClient();
  const [edcEntries, setEdcEntries] = useState<EdcEntry[]>([]);

  const { data: stores = [], isLoading: storesLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
    retry: false,
  });

  const bazarStores = stores.filter(s => s.storeCategory === 'bazar');

  const edcOptions = useQuery<Edc[]>({
    queryKey: ["/api/edc"],
    retry: false,
  }).data || [];

  const form = useForm<SettlementFormData>({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: {
      settlementType: "store",
      kodeGudang: user?.store_id || "",
      bazarId: "",
      tanggal: new Date().toISOString().split('T')[0],
      cashAwal: "",
      cashAkhir: "",
      variance: "0",
    },
  });

  const settlementType = form.watch("settlementType");
  const watchCashAwal = form.watch("cashAwal");
  const watchCashAkhir = form.watch("cashAkhir");

  const { data: existingEdcSettlements } = useQuery<EdcSettlement[]>({
    queryKey: ['/api/edc-settlements', { settlement_id: settlement?.settlementId }],
    queryFn: async () => {
      if (!settlement?.settlementId) return [];
      const response = await fetch(`/api/edc-settlements?settlement_ids=${settlement.settlementId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!settlement,
  });

  useEffect(() => {
    if (isOpen) {
      if (settlement) {
        const isBazarStore = stores.find(s => s.kodeGudang === settlement.kodeGudang)?.storeCategory === 'bazar';
        form.reset({
          settlementType: isBazarStore || settlement.bazarId ? "bazar" : "store",
          kodeGudang: settlement.kodeGudang || "",
          bazarId: settlement.bazarId?.toString() || "",
          tanggal: settlement.tanggal,
          cashAwal: settlement.cashAwal.toString(),
          cashAkhir: settlement.cashAkhir.toString(),
          variance: settlement.variance.toString(),
        });
        
        if (existingEdcSettlements) {
          setEdcEntries(existingEdcSettlements.map(edc => ({
            edcId: edc.storeEdcId.toString(),
            amount: edc.settlementValue.toString()
          })));
        }
      } else {
        form.reset({
          settlementType: bazarStores.length > 0 ? "bazar" : "store",
          kodeGudang: user?.store_id || "",
          bazarId: "",
          tanggal: new Date().toISOString().split('T')[0],
          cashAwal: "",
          cashAkhir: "",
          variance: "0",
        });
        setEdcEntries([]);
      }
    }
  }, [isOpen, settlement, existingEdcSettlements, form, bazarStores, user]);

  useEffect(() => {
    if (watchCashAwal && watchCashAkhir) {
      const awal = parseFloat(watchCashAwal) || 0;
      const akhir = parseFloat(watchCashAkhir) || 0;
      const variance = akhir - awal;
      form.setValue("variance", variance.toString());
    }
  }, [watchCashAwal, watchCashAkhir, form]);

  const addEdcEntry = () => {
    setEdcEntries([...edcEntries, { edcId: "", amount: "" }]);
  };

  const removeEdcEntry = (index: number) => {
    setEdcEntries(edcEntries.filter((_, i) => i !== index));
  };

  const updateEdcEntry = (index: number, field: keyof EdcEntry, value: string) => {
    const updated = [...edcEntries];
    updated[index][field] = value;
    setEdcEntries(updated);
  };

  const getTotalEdc = () => {
    return edcEntries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
  };

  const saveSettlementMutation = useMutation({
    mutationFn: async (data: SettlementFormData) => {
      const payload: any = {
        tanggal: data.tanggal,
        cashAwal: data.cashAwal,
        cashAkhir: data.cashAkhir,
        variance: data.variance,
        edcEntries: edcEntries.filter(e => e.edcId && e.amount).map(e => ({
          edcId: parseInt(e.edcId),
          amount: e.amount,
        })),
      };

      payload.kodeGudang = data.kodeGudang;

      const method = settlement ? 'PATCH' : 'POST';
      const url = settlement ? `/api/settlements/${settlement.settlementId}` : '/api/settlements';
      const response = await apiRequest(method, url, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: settlement ? "Settlement Updated" : "Settlement Created",
        description: `Settlement has been ${settlement ? 'updated' : 'created'} successfully`,
      });
      
      form.reset();
      setEdcEntries([]);
      queryClient.invalidateQueries({ queryKey: ['/api/settlements'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: settlement ? "Settlement Update Failed" : "Settlement Creation Failed",
        description: error.message || `Failed to ${settlement ? 'update' : 'create'} settlement`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettlementFormData) => {
    saveSettlementMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setEdcEntries([]);
    onClose();
  };

  const availableStores = user?.can_access_all_stores 
    ? stores 
    : stores.filter(store => store.kodeGudang === user?.store_id);

  const getEdcName = (edcId: string) => {
    const edc = edcOptions.find(e => e.edcId.toString() === edcId);
    return edc ? `${edc.namaEdc} (${edc.jenisEdc})` : "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{settlement ? "Edit Settlement" : "Create New Settlement"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {bazarStores.length > 0 && (
              <FormField
                control={form.control}
                name="settlementType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Settlement Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bazar">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            Bazar Settlement
                          </span>
                        </SelectItem>
                        <SelectItem value="store">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Regular Store Settlement
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {settlementType === "store" && (
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
            )}

            {settlementType === "bazar" && (
              <FormField
                control={form.control}
                name="kodeGudang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Bazar Store</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bazar">
                          <SelectValue placeholder="Select a bazar store" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bazarStores.length === 0 ? (
                          <SelectItem value="" disabled>No bazar stores available</SelectItem>
                        ) : (
                          bazarStores.map((store) => (
                            <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                {store.namaGudang} ({store.kodeGudang})
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cashAwal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Cash</FormLabel>
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
                    <FormLabel>Ending Cash</FormLabel>
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
            </div>

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm">EDC Payments</span>
                    {edcEntries.length > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {edcEntries.length} entry
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEdcEntry}
                    disabled={edcOptions.length === 0}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add EDC
                  </Button>
                </div>

                {edcOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No payment methods configured. Add EDC options in Admin Settings.
                  </p>
                ) : edcEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No EDC payments added. Click "Add EDC" to include card payments.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {edcEntries.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={entry.edcId}
                          onValueChange={(val) => updateEdcEntry(index, "edcId", val)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select bank/EDC" />
                          </SelectTrigger>
                          <SelectContent>
                            {edcOptions.map((edc) => (
                              <SelectItem key={edc.edcId} value={edc.edcId.toString()}>
                                {edc.namaEdc} ({edc.jenisEdc})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          className="w-32"
                          value={entry.amount}
                          onChange={(e) => updateEdcEntry(index, "amount", e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEdcEntry(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {edcEntries.length > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t mt-2">
                        <span className="text-sm font-medium text-gray-600">Total EDC:</span>
                        <span className="font-semibold text-blue-600">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(getTotalEdc())}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <FormField
              control={form.control}
              name="variance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cash Variance (Auto-calculated)</FormLabel>
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
                disabled={saveSettlementMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveSettlementMutation.isPending}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                data-testid="button-create-settlement"
              >
                {saveSettlementMutation.isPending ? (settlement ? 'Updating...' : 'Creating...') : (settlement ? 'Update Settlement' : 'Create Settlement')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
