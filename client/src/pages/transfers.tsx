import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

import { Sidebar } from "@/components/sidebar";
import { TransferImportModal } from "@/components/TransferImportModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Trash2, Edit, Plus, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const transferFormSchema = z.object({
  dariGudang: z.string().min(1, "Source store is required"),
  keGudang: z.string().min(1, "Destination store is required"),
  tanggal: z.string().min(1, "Date is required"),
  file: z.instanceof(File, { message: "File is required" }),
});

type TransferFormData = z.infer<typeof transferFormSchema>;

export default function Transfers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);
  const [toStoreOpen, setToStoreOpen] = useState(false);
  const [fromStoreOpen, setFromStoreOpen] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransferForDetails, setSelectedTransferForDetails] = useState<any>(null);
  const [transferFile, setTransferFile] = useState<File | null>(null);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      dariGudang: "",
      keGudang: "",
      tanggal: new Date().toISOString().split('T')[0],
      file: undefined as any,
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

  // Create transfer with file mutation
  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const formData = new FormData();
      formData.append('dariGudang', data.dariGudang);
      formData.append('keGudang', data.keGudang);
      formData.append('tanggal', data.tanggal);
      formData.append('file', data.file);
      
      const response = await fetch('/api/transfers/create-with-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create transfer');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: `Transfer order created with ${result.import?.inserted || 0} items imported`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      form.reset();
      setTransferFile(null);
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
          window.location.replace("/api/login");
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
                        key={transfer.toNumber}
                        className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        data-testid={`card-transfer-${transfer.toNumber}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <i className="fas fa-exchange-alt text-white"></i>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              Transfer {transfer.toNumber}
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
                                setSelectedTransferId(transfer.toNumber);
                                setShowImportModal(true);
                              }}
                              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              data-testid={`button-import-items-${transfer.toNumber}`}
                            >
                              <i className="fas fa-upload mr-1"></i>
                              Import Items
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTransferForDetails(transfer);
                                setShowDetailsModal(true);
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              data-testid={`button-view-transfer-${transfer.toNumber}`}
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
                    <Popover open={fromStoreOpen} onOpenChange={setFromStoreOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={fromStoreOpen}
                            className="w-full justify-between text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            data-testid="select-from-store"
                          >
                            {field.value
                              ? stores?.find((store: any) => store.kodeGudang === field.value)?.namaGudang
                              : "Select source store"}
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
                                    setFromStoreOpen(false);
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

              <FormField
                control={form.control}
                name="file"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">
                      Import File (Required) <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onChange(file);
                            setTransferFile(file);
                          }
                        }}
                        data-testid="input-transfer-file"
                        className="cursor-pointer"
                        {...field}
                      />
                    </FormControl>
                    {transferFile && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Selected: {transferFile.name} ({(transferFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  CSV/Excel file will be imported immediately after creating the Transfer Order.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Required columns: sn, kode_item, nama_item (optional), qty
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

      {/* Transfer Import Modal - Production Ready */}
      <TransferImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setSelectedTransferId(null);
        }}
        transferId={selectedTransferId || 0}
        onImportComplete={() => {
          // Refresh transfer orders data
          queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
        }}
      />

      {/* Transfer Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Transfer Order Details {selectedTransferForDetails?.toNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedTransferForDetails && (
            <TransferDetailsContent 
              transfer={selectedTransferForDetails} 
              stores={stores}
              onClose={() => setShowDetailsModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form schemas for editing
const transferEditSchema = z.object({
  dariGudang: z.string().min(1, "From store is required"),
  keGudang: z.string().min(1, "To store is required"),
  tanggal: z.string().min(1, "Date is required")
});

const itemEditSchema = z.object({
  kodeItem: z.string().min(1, "Item code is required"),
  namaItem: z.string().min(1, "Item name is required"),
  sn: z.string().optional(),
  qty: z.number().min(1, "Quantity must be at least 1")
});

// Transfer Details Content Component
function TransferDetailsContent({ transfer, stores, onClose }: { 
  transfer: any, 
  stores: any[] | undefined, 
  onClose: () => void 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transferItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/transfers', transfer.toNumber, 'items'],
    enabled: !!transfer.toNumber,
  });

  // Filter items based on search query
  const filteredItems = transferItems && Array.isArray(transferItems) 
    ? transferItems.filter((item: any) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const kodeMatch = (item.kodeItem || '').toLowerCase().includes(query);
        const namaMatch = (item.namaItem || '').toLowerCase().includes(query);
        const snMatch = (item.sn || '').toLowerCase().includes(query);
        return kodeMatch || namaMatch || snMatch;
      })
    : [];

  // Form for editing transfer basic info
  const transferForm = useForm<z.infer<typeof transferEditSchema>>({
    resolver: zodResolver(transferEditSchema),
    defaultValues: {
      dariGudang: transfer.dariGudang,
      keGudang: transfer.keGudang,
      tanggal: transfer.tanggal
    }
  });

  // Form for editing/adding items
  const itemForm = useForm<z.infer<typeof itemEditSchema>>({
    resolver: zodResolver(itemEditSchema),
    defaultValues: {
      kodeItem: '',
      namaItem: '',
      sn: '',
      qty: 1
    }
  });

  const fromStore = stores?.find((s: any) => s.kodeGudang === transfer.dariGudang);
  const toStore = stores?.find((s: any) => s.kodeGudang === transfer.keGudang);

  // Update transfer mutation
  const updateTransferMutation = useMutation({
    mutationFn: async (data: z.infer<typeof transferEditSchema>) => {
      return await apiRequest(`/api/transfers/${transfer.toNumber}`, 'PUT', data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Transfer updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/transfers'] });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error('Transfer update error:', error);
      toast({ title: "Error", description: "Failed to update transfer", variant: "destructive" });
    }
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number, data: any }) => {
      return await apiRequest(`/api/transfers/${transfer.toNumber}/items/${itemId}`, 'PUT', data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/transfers', transfer.toNumber, 'items'] });
      setEditingItemId(null);
      itemForm.reset();
    },
    onError: (error) => {
      console.error('Item update error:', error);
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/transfers/${transfer.toNumber}/items`, 'POST', data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item added successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/transfers', transfer.toNumber, 'items'] });
      setShowAddItem(false);
      itemForm.reset();
    },
    onError: (error) => {
      console.error('Item add error:', error);
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    }
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest(`/api/transfers/${transfer.toNumber}/items/${itemId}`, 'DELETE');
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/transfers', transfer.toNumber, 'items'] });
    },
    onError: (error) => {
      console.error('Item delete error:', error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  });

  const handleTransferUpdate = (data: z.infer<typeof transferEditSchema>) => {
    updateTransferMutation.mutate(data);
  };

  const handleItemUpdate = (data: z.infer<typeof itemEditSchema>) => {
    if (editingItemId) {
      updateItemMutation.mutate({ itemId: editingItemId, data });
    }
  };

  const handleItemAdd = (data: z.infer<typeof itemEditSchema>) => {
    addItemMutation.mutate(data);
  };

  const startEditingItem = (item: any) => {
    setEditingItemId(item.toItemListId);
    itemForm.reset({
      kodeItem: item.kodeItem,
      namaItem: item.namaItem,
      sn: item.sn || '',
      qty: item.qty
    });
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
    itemForm.reset();
  };

  const startAddingItem = () => {
    setShowAddItem(true);
    itemForm.reset({
      kodeItem: '',
      namaItem: '',
      sn: '',
      qty: 1
    });
  };

  return (
    <div className="space-y-6">
      {/* Edit Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Transfer Information
        </h3>
        <div className="flex space-x-2">
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-transfer"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Transfer
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  transferForm.reset();
                }}
                data-testid="button-cancel-edit-transfer"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={transferForm.handleSubmit(handleTransferUpdate)}
                disabled={updateTransferMutation.isPending}
                data-testid="button-save-transfer"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Info */}
      {isEditing ? (
        <Form {...transferForm}>
          <form className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormField
                control={transferForm.control}
                name="dariGudang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Store</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-from-store">
                          <SelectValue placeholder="Select from store" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores?.map((store) => (
                          <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                            {store.namaGudang} ({store.kodeGudang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="tanggal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-transfer-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-4">
              <FormField
                control={transferForm.control}
                name="keGudang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Store</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-to-store">
                          <SelectValue placeholder="Select to store" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores?.map((store) => (
                          <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                            {store.namaGudang} ({store.kodeGudang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">TO Number</Label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {transfer.toNumber}
                </p>
              </div>
            </div>
          </form>
        </Form>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">From Store</label>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {fromStore?.namaGudang || transfer.dariGudang}
              </p>
              <p className="text-sm text-gray-500">{transfer.dariGudang}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Transfer Date</label>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {transfer.tanggal}
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">To Store</label>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {toStore?.namaGudang || transfer.keGudang}
              </p>
              <p className="text-sm text-gray-500">{transfer.keGudang}</p>
            </div>
            {transfer.toNumber && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">TO Number</label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {transfer.toNumber}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Items */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transfer Items {transferItems && Array.isArray(transferItems) ? `(${transferItems.length} items)` : ''}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={startAddingItem}
            data-testid="button-add-item"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
        
        {/* Search Box */}
        <div className="mb-4">
          <Input
            placeholder="Search by item code, name, or serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            data-testid="input-search-items"
          />
          {searchQuery && filteredItems.length !== (Array.isArray(transferItems) ? transferItems.length : 0) && (
            <p className="text-sm text-gray-500 mt-1">
              Showing {filteredItems.length} of {Array.isArray(transferItems) ? transferItems.length : 0} items
            </p>
          )}
        </div>
        
        {itemsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <Skeleton className="w-32 h-4" />
                    <Skeleton className="w-48 h-3" />
                  </div>
                  <Skeleton className="w-16 h-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {filteredItems.map((item: any, index: number) => (
              <div 
                key={item.toItemListId || index} 
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {editingItemId === item.toItemListId ? (
                  <Form {...itemForm}>
                    <form onSubmit={itemForm.handleSubmit(handleItemUpdate)} className="space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <FormField
                          control={itemForm.control}
                          name="kodeItem"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item Code</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid={`input-edit-item-code-${item.toItemListId}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="namaItem"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid={`input-edit-item-name-${item.toItemListId}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="sn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Serial Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid={`input-edit-item-sn-${item.toItemListId}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="qty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  data-testid={`input-edit-item-qty-${item.toItemListId}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          type="submit" 
                          size="sm"
                          disabled={updateItemMutation.isPending}
                          data-testid={`button-save-item-${item.toItemListId}`}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={cancelEditingItem}
                          data-testid={`button-cancel-edit-item-${item.toItemListId}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.kodeItem}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {item.namaItem}
                      </p>
                      {item.sn && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          S/N: {item.sn}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Qty: {item.qty}
                      </p>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingItem(item)}
                          data-testid={`button-edit-item-${item.toItemListId}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteItemMutation.mutate(item.toItemListId)}
                          disabled={deleteItemMutation.isPending}
                          data-testid={`button-delete-item-${item.toItemListId}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add New Item Form */}
            {showAddItem && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <Form {...itemForm}>
                  <form onSubmit={itemForm.handleSubmit(handleItemAdd)} className="space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Add New Item</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <FormField
                        control={itemForm.control}
                        name="kodeItem"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Code</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-new-item-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemForm.control}
                        name="namaItem"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-new-item-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemForm.control}
                        name="sn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Serial Number</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-new-item-sn" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemForm.control}
                        name="qty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-new-item-qty"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        type="submit" 
                        size="sm"
                        disabled={addItemMutation.isPending}
                        data-testid="button-save-new-item"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setShowAddItem(false);
                          itemForm.reset();
                        }}
                        data-testid="button-cancel-new-item"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <i className="fas fa-inbox text-3xl mb-3 opacity-50"></i>
            {searchQuery ? (
              <>
                <p>No items match your search "{searchQuery}"</p>
                <p className="text-sm">Try a different search term or clear the search box.</p>
              </>
            ) : (
              <>
                <p>No items found for this transfer order.</p>
                <p className="text-sm">Items will appear here after importing from Excel files.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Import Progress Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          🔍 How to Check Import Status:
        </h4>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p>• <strong>During Import:</strong> Watch for real-time progress in the import dialog</p>
          <p>• <strong>After Import:</strong> Items will automatically appear in this details view</p>
          <p>• <strong>Import Failed?</strong> Check the import dialog for error details and retry individual failed records</p>
        </div>
      </div>
    </div>
  );
}
