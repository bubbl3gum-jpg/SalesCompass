import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

import { Sidebar } from "@/components/sidebar";
import { ImportModal } from "@/components/import-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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

const transferFormSchema = z.object({
  dariGudang: z.string().min(1, "Source store is required"),
  keGudang: z.string().min(1, "Destination store is required"),
  tanggal: z.string().min(1, "Date is required"),
});

type TransferFormData = z.infer<typeof transferFormSchema>;

export default function Transfers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);
  const [toStoreOpen, setToStoreOpen] = useState(false);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      dariGudang: "",
      keGudang: "",
      tanggal: new Date().toISOString().split('T')[0],
    },
  });

  // Get stores
  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
    retry: false,
  });

  // Get transfer orders
  const { data: transfers, isLoading: transfersLoading } = useQuery<any[]>({
    queryKey: ["/api/transfers"],
    retry: false,
  });

  // Create transfer mutation
  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const response = await apiRequest('POST', '/api/transfers', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transfer order created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      form.reset();
      setShowTransferModal(false);
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
        description: "Failed to create transfer order",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransferFormData) => {
    if (data.dariGudang === data.keGudang) {
      toast({
        title: "Validation Error",
        description: "Source and destination stores must be different",
        variant: "destructive",
      });
      return;
    }
    createTransferMutation.mutate(data);
  };

  const getTransferStatus = (transfer: any) => {
    // Mock status logic - in real app this would come from API
    return { status: 'Pending', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Transfer Orders</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage stock transfers between stores</p>
            </div>
            <div className="flex space-x-3">
              
              <Button
                onClick={() => setShowTransferModal(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                data-testid="button-new-transfer"
              >
                <i className="fas fa-plus mr-2"></i>
                New Transfer
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Transfer Orders List */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Transfer Orders
                {transfers && <span className="ml-2 text-sm text-gray-500">({transfers.length} orders)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transfersLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                        <div className="flex items-center space-x-4">
                          <Skeleton className="w-12 h-12 rounded-lg" />
                          <div className="space-y-2">
                            <Skeleton className="w-32 h-4" />
                            <Skeleton className="w-24 h-3" />
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Skeleton className="w-20 h-6 rounded-full" />
                          <Skeleton className="w-16 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : transfers && transfers.length > 0 ? (
                <div className="space-y-4">
                  {transfers.map((transfer: any) => {
                    const status = getTransferStatus(transfer);
                    const fromStore = stores?.find((s: any) => s.kodeGudang === transfer.dariGudang);
                    const toStore = stores?.find((s: any) => s.kodeGudang === transfer.keGudang);

                    return (
                      <div
                        key={transfer.toId}
                        className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        data-testid={`card-transfer-${transfer.toId}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <i className="fas fa-exchange-alt text-white"></i>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              Transfer #{transfer.toId}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {fromStore?.namaGudang || transfer.dariGudang} → {toStore?.namaGudang || transfer.keGudang}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Date: {transfer.tanggal}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Badge className={`${status.color} border-0`}>
                            {status.status}
                          </Badge>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTransferId(transfer.toId);
                                setShowImportModal(true);
                              }}
                              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              data-testid={`button-import-items-${transfer.toId}`}
                            >
                              <i className="fas fa-upload mr-1"></i>
                              Import Items
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              data-testid={`button-view-transfer-${transfer.toId}`}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-exchange-alt text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No transfer orders</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    No transfer orders have been created yet.
                  </p>
                  <Button
                    onClick={() => setShowTransferModal(true)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    data-testid="button-create-first-transfer"
                  >
                    Create First Transfer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* New Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              New Transfer Order
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="dariGudang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">From Store</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-from-store">
                          <SelectValue placeholder="Select source store" />
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keGudang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">To Store</FormLabel>
                    <Popover open={toStoreOpen} onOpenChange={setToStoreOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={toStoreOpen}
                            className="w-full justify-between text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            data-testid="select-to-store"
                          >
                            {field.value
                              ? stores?.find((store: any) => store.kodeGudang === field.value)?.namaGudang
                              : "Select destination store"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search stores..." 
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
                                    field.onChange(store.kodeGudang);
                                    setToStoreOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === store.kodeGudang ? "opacity-100" : "opacity-0"
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tanggal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">Transfer Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-transfer-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  After creating the Transfer Order, you can import items using CSV or Excel files.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Required format: sn, kode_item, nama_item, qty (all fields must be included in transfer imports)
                </p>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTransferModal(false)}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  data-testid="button-cancel-transfer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={createTransferMutation.isPending}
                  data-testid="button-create-transfer"
                >
                  {createTransferMutation.isPending ? "Creating..." : "Create Transfer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setSelectedTransferId(null);
        }}
        title={`Import Items for Transfer Order #${selectedTransferId || ''}`}
        tableName="transfer-items"
        queryKey="/api/transfers"
        endpoint="/api/import"
        additionalData={{ toId: selectedTransferId }}
        sampleData={[
          'sn (serial number, optional)',
          'kode_item (item code)',
          'nama_item (item name)',
          'qty (quantity to transfer)'
        ]}
      />
    </div>
  );
}
