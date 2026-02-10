import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Trash2, Upload, Package } from "lucide-react";
import type { VirtualStoreInventory } from "@shared/schema";

interface StoreConfig {
  kodeGudang: string;
  namaGudang: string | null;
  jenisGudang: string | null;
  storeType: string | null;
  storeCategory: string | null;
  discounts: Array<{
    storeDiscountsId: number;
    kodeGudang: string;
    discountId: number;
    discountName: string | null;
    discountType: string | null;
    discountAmount: string | null;
  }>;
  edcs: Array<{
    storeEdcId: number;
    kodeGudang: string;
    edcId: number;
    namaGudang: string | null;
    merchantName: string | null;
    edcType: string | null;
    adminFee: string | null;
    edcKey: string | null;
  }>;
}

export default function StoreConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useStoreAuth();
  const { isExpanded } = useSidebar();
  const isAdmin = hasPermission("admin:settings");
  const isSupervisor = user?.role === "Supervisor";

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [showAssignDiscountModal, setShowAssignDiscountModal] = useState(false);
  const [assigningDiscount, setAssigningDiscount] = useState<string>("");
  const [showAssignEdcModal, setShowAssignEdcModal] = useState(false);
  const [assigningEdcId, setAssigningEdcId] = useState<string>("");
  const [removingDiscount, setRemovingDiscount] = useState<any>(null);
  const [removingEdc, setRemovingEdc] = useState<any>(null);

  const [inventorySearch, setInventorySearch] = useState("");
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [showImportInventoryModal, setShowImportInventoryModal] = useState(false);
  const [newInventoryItem, setNewInventoryItem] = useState({ sn: "", kodeItem: "", sc: "", namaBarang: "", qty: 1 });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: storeConfigs, isLoading } = useQuery<StoreConfig[]>({
    queryKey: ['/api/store-config'],
  });

  const { data: allDiscounts } = useQuery<any[]>({
    queryKey: ['/api/discounts'],
  });

  const { data: allEdcs } = useQuery<any[]>({
    queryKey: ['/api/edc'],
  });

  const { data: storeTypes } = useQuery<Array<{ id: number; typeName: string }>>({
    queryKey: ['/api/store-types'],
  });

  const { data: bazarTypes } = useQuery<Array<{ id: number; typeName: string }>>({
    queryKey: ['/api/bazar-types'],
  });

  const { data: storeInventory, isLoading: inventoryLoading } = useQuery<VirtualStoreInventory[]>({
    queryKey: ['/api/virtual-inventory', selectedStore],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/virtual-inventory?store=${selectedStore}`);
      return res.json();
    },
    enabled: !!selectedStore,
  });

  const updateStoreMutation = useMutation({
    mutationFn: async ({ kodeGudang, data }: { kodeGudang: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/store-config/${kodeGudang}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/store-config'] });
      toast({ title: "Store updated", description: "Store configuration saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update store configuration", variant: "destructive" });
    },
  });

  const assignDiscountMutation = useMutation({
    mutationFn: async ({ kodeGudang, discountId }: { kodeGudang: string; discountId: number }) => {
      const res = await apiRequest('POST', '/api/store-discounts', { kodeGudang, discountId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/store-config'] });
      setShowAssignDiscountModal(false);
      setAssigningDiscount("");
      toast({ title: "Discount assigned", description: "Discount added to store successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to assign discount", variant: "destructive" });
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: async (storeDiscountsId: number) => {
      await apiRequest('DELETE', `/api/store-discounts/${storeDiscountsId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/store-config'] });
      setRemovingDiscount(null);
      toast({ title: "Discount removed", description: "Discount removed from store" });
    },
  });

  const assignEdcMutation = useMutation({
    mutationFn: async ({ kodeGudang, edcId, namaGudang, merchantName, edcType }: any) => {
      const res = await apiRequest('POST', '/api/store-edc', { kodeGudang, edcId, namaGudang, merchantName, edcType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/store-config'] });
      setShowAssignEdcModal(false);
      setAssigningEdcId("");
      toast({ title: "Payment method assigned", description: "Payment method added to store" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign payment method to store", variant: "destructive" });
    },
  });

  const removeEdcMutation = useMutation({
    mutationFn: async (storeEdcId: number) => {
      await apiRequest('DELETE', `/api/store-edc/${storeEdcId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/store-config'] });
      setRemovingEdc(null);
      toast({ title: "Payment method removed", description: "Payment method removed from store" });
    },
  });

  const invalidateInventory = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/virtual-inventory');
      }
    });
    queryClient.invalidateQueries({ queryKey: ['/api/virtual-inventory', selectedStore] });
  };

  const createInventoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/virtual-inventory', data);
    },
    onSuccess: () => {
      invalidateInventory();
      setShowAddInventoryModal(false);
      setNewInventoryItem({ sn: "", kodeItem: "", sc: "", namaBarang: "", qty: 1 });
      toast({ title: "Success", description: "Inventory item added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" });
    },
  });

  const deleteInventoryMutation = useMutation({
    mutationFn: async (inventoryId: number) => {
      return await apiRequest('DELETE', `/api/virtual-inventory/${inventoryId}`);
    },
    onSuccess: () => {
      invalidateInventory();
      toast({ title: "Success", description: "Item deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete item", variant: "destructive" });
    },
  });

  const handleAddInventoryItem = () => {
    if (!selectedStore) return;
    if (!newInventoryItem.sn) {
      toast({ title: "Error", description: "Serial number (SN) is required", variant: "destructive" });
      return;
    }
    createInventoryMutation.mutate({ kodeGudang: selectedStore, ...newInventoryItem });
  };

  const handleInventoryFileUpload = async () => {
    if (!selectedStore) {
      toast({ title: "Error", description: "Please select a store first", variant: "destructive" });
      return;
    }
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to upload", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('kodeGudang', selectedStore);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/virtual-inventory/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Upload failed');
      invalidateInventory();
      setShowImportInventoryModal(false);
      setImportFile(null);
      toast({ title: "Import Complete", description: `Successfully imported ${result.success} items.` });
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message || "Failed to import file", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredStores = useMemo(() => {
    if (!storeConfigs) return [];
    let filtered = storeConfigs;

    if (isSupervisor && user?.store_id) {
      filtered = filtered.filter(s => s.kodeGudang === user.store_id);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.kodeGudang.toLowerCase().includes(term) ||
        (s.namaGudang && s.namaGudang.toLowerCase().includes(term))
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter(s => (s.storeType || "independent") === filterType);
    }
    if (filterCategory !== "all") {
      filtered = filtered.filter(s => (s.storeCategory || "normal") === filterCategory);
    }

    return filtered;
  }, [storeConfigs, searchTerm, filterType, filterCategory, isSupervisor, user]);

  const selectedStoreData = useMemo(() => {
    if (!selectedStore || !storeConfigs) return null;
    return storeConfigs.find(s => s.kodeGudang === selectedStore) || null;
  }, [selectedStore, storeConfigs]);

  const availableDiscountsForStore = useMemo(() => {
    if (!allDiscounts || !selectedStoreData) return [];
    const assignedIds = new Set(selectedStoreData.discounts.map(d => d.discountId));
    return allDiscounts.filter(d => !assignedIds.has(d.discountId));
  }, [allDiscounts, selectedStoreData]);

  const availableEdcsForStore = useMemo(() => {
    if (!allEdcs || !selectedStoreData) return [];
    const assignedIds = new Set(selectedStoreData.edcs.map(e => e.edcId));
    return allEdcs.filter(e => !assignedIds.has(e.edcId));
  }, [allEdcs, selectedStoreData]);

  const handleAssignDiscount = () => {
    if (!selectedStore || !assigningDiscount) return;
    assignDiscountMutation.mutate({ kodeGudang: selectedStore, discountId: parseInt(assigningDiscount) });
  };

  const filteredInventory = useMemo(() => {
    if (!storeInventory) return [];
    if (!inventorySearch) return storeInventory;
    const query = inventorySearch.toLowerCase();
    return storeInventory.filter(item =>
      item.sn?.toLowerCase().includes(query) ||
      item.kodeItem?.toLowerCase().includes(query) ||
      item.namaBarang?.toLowerCase().includes(query)
    );
  }, [storeInventory, inventorySearch]);

  const handleAssignEdc = () => {
    if (!selectedStore || !assigningEdcId) return;
    const edcData = allEdcs?.find((e: any) => e.edcId === parseInt(assigningEdcId));
    if (!edcData) return;
    const store = selectedStoreData;
    assignEdcMutation.mutate({
      kodeGudang: selectedStore,
      edcId: edcData.edcId,
      namaGudang: store?.namaGudang || "",
      merchantName: edcData.namaEdc || edcData.merchantName || "",
      edcType: edcData.jenisEdc || edcData.edcType || "",
      adminFee: edcData.biayaAdmin || edcData.adminFee || null,
      edcKey: edcData.edcKey || null,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Store Configuration</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Central hub for managing store settings, discounts, and payment methods
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Store List Panel */}
            <div className="w-full lg:w-96 lg:flex-shrink-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Stores</CardTitle>
                  <div className="space-y-2 mt-2">
                    <Input
                      placeholder="Search stores..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9"
                    />
                    <div className="flex gap-2">
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="independent">Independent</SelectItem>
                          <SelectItem value="dependent">Dependent</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bazar">Bazar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                      {filteredStores.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">No stores found</div>
                      ) : (
                        filteredStores.map(store => (
                          <button
                            key={store.kodeGudang}
                            onClick={() => setSelectedStore(store.kodeGudang)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                              selectedStore === store.kodeGudang ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {store.namaGudang || store.kodeGudang}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{store.kodeGudang}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                                  store.storeType && store.storeType.toLowerCase() !== 'independent'
                                    ? 'border-orange-300 text-orange-600 dark:border-orange-600 dark:text-orange-400' 
                                    : store.storeType?.toLowerCase() === 'independent'
                                    ? 'border-green-300 text-green-600 dark:border-green-600 dark:text-green-400'
                                    : 'border-red-300 text-red-500 dark:border-red-600 dark:text-red-400'
                                }`}>
                                  {store.storeType && store.storeType.toLowerCase() !== 'independent' ? store.storeType : store.storeType?.toLowerCase() === 'independent' ? 'Independent' : '-'}
                                </Badge>
                                {(store.storeCategory || 'normal') === 'bazar' && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 dark:border-purple-600 dark:text-purple-400">
                                    Bazar
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-1.5">
                              {store.discounts.length > 0 && (
                                <span className="text-[10px] text-gray-400">
                                  <i className="fas fa-percentage mr-1" />{store.discounts.length} discounts
                                </span>
                              )}
                              {store.edcs.length > 0 && (
                                <span className="text-[10px] text-gray-400">
                                  <i className="fas fa-credit-card mr-1" />{store.edcs.length} payment methods
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 text-center">{filteredStores.length} stores</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Store Detail Panel */}
            <div className="flex-1 min-w-0">
              {!selectedStore ? (
                <Card className="h-[calc(100vh-200px)] flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <i className="fas fa-store text-4xl mb-3 block" />
                    <p className="text-lg font-medium">Select a store</p>
                    <p className="text-sm mt-1">Choose a store from the list to view and edit its configuration</p>
                  </div>
                </Card>
              ) : selectedStoreData ? (
                <div className="space-y-4">
                  {/* Store Info Header */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl text-gray-900 dark:text-white">{selectedStoreData.namaGudang || selectedStoreData.kodeGudang}</CardTitle>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Code: {selectedStoreData.kodeGudang}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStore(null)} className="text-gray-400">
                          <i className="fas fa-times" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Store Category */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Store Category</label>
                          <Select
                            value={selectedStoreData.storeCategory || "normal"}
                            onValueChange={(value) => {
                              if (!isAdmin) return;
                              updateStoreMutation.mutate({ 
                                kodeGudang: selectedStoreData.kodeGudang, 
                                data: { storeCategory: value, storeType: "" } 
                              });
                            }}
                            disabled={!isAdmin}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal Store</SelectItem>
                              <SelectItem value="bazar">Bazar</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-400 mt-1">
                            {(selectedStoreData.storeCategory || "normal") === "bazar"
                              ? "Bazar stores have daily settlement tracking"
                              : "Regular retail store operation"}
                          </p>
                        </div>

                        {/* Store Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                            {(selectedStoreData.storeCategory || "normal") === "bazar" ? "Bazar Type" : "Store Type"}
                          </label>
                          <Select
                            value={selectedStoreData.storeType || ""}
                            onValueChange={(value) => {
                              if (!isAdmin) return;
                              updateStoreMutation.mutate({ kodeGudang: selectedStoreData.kodeGudang, data: { storeType: value } });
                            }}
                            disabled={!isAdmin}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder={
                                (selectedStoreData.storeCategory || "normal") === "bazar"
                                  ? "Select bazar type..."
                                  : "Select department store..."
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Independent">Independent</SelectItem>
                              {(selectedStoreData.storeCategory || "normal") === "bazar"
                                ? bazarTypes?.map(type => (
                                    <SelectItem key={type.id} value={type.typeName}>{type.typeName}</SelectItem>
                                  ))
                                : storeTypes?.map(type => (
                                    <SelectItem key={type.id} value={type.typeName}>{type.typeName}</SelectItem>
                                  ))
                              }
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-400 mt-1">
                            {(selectedStoreData.storeCategory || "normal") === "bazar"
                              ? "Type of bazar event for this store"
                              : "Department store where this store is located (for payment method tracking)"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Discounts Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-gray-900 dark:text-white">
                          <i className="fas fa-percentage mr-2 text-blue-500" />
                          Discounts
                        </CardTitle>
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => setShowAssignDiscountModal(true)}>
                            <i className="fas fa-plus mr-1" /> Add Discount
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectedStoreData.discounts.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-300 text-center py-4">No discounts assigned to this store</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedStoreData.discounts.map(discount => (
                            <div
                              key={discount.storeDiscountsId}
                              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                            >
                              <div>
                                <p className="font-medium text-sm">{discount.discountName || `Discount #${discount.discountId}`}</p>
                                <p className="text-xs text-gray-500">
                                  {discount.discountType === 'percentage' ? `${discount.discountAmount}%` : `Rp ${Number(discount.discountAmount || 0).toLocaleString()}`}
                                  {discount.discountType && <span className="ml-2 text-gray-400">({discount.discountType})</span>}
                                </p>
                              </div>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setRemovingDiscount(discount)}
                                >
                                  <i className="fas fa-trash text-xs" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payment Methods Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base text-gray-900 dark:text-white">
                            <i className="fas fa-credit-card mr-2 text-green-500" />
                            Payment Methods
                          </CardTitle>
                          {selectedStoreData.storeType && selectedStoreData.storeType.toLowerCase() !== 'independent' && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-6">
                              Dept. Store: {selectedStoreData.storeType}
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => setShowAssignEdcModal(true)}>
                            <i className="fas fa-plus mr-1" /> Add Payment Method
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectedStoreData.edcs.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-300 text-center py-4">No payment methods assigned to this store</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedStoreData.edcs.map(edcItem => (
                            <div
                              key={edcItem.storeEdcId}
                              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                  <i className="fas fa-credit-card text-green-600 dark:text-green-400 text-xs" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{edcItem.merchantName || `Payment Method #${edcItem.edcId}`}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {edcItem.edcType && <Badge variant="outline" className="text-[10px]">{edcItem.edcType}</Badge>}
                                    {edcItem.edcKey && (
                                      <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400">
                                        Key: {edcItem.edcKey}
                                      </Badge>
                                    )}
                                    {edcItem.adminFee && Number(edcItem.adminFee) > 0 && (
                                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-600 dark:text-amber-400">
                                        Fee: {Number(edcItem.adminFee)}%
                                      </Badge>
                                    )}
                                    {selectedStoreData.storeType && selectedStoreData.storeType.toLowerCase() !== 'independent' && (
                                      <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                                        {selectedStoreData.storeType}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setRemovingEdc(edcItem)}
                                >
                                  <i className="fas fa-trash text-xs" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Virtual Store Inventory Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-gray-900 dark:text-white">
                          <Package className="inline-block w-4 h-4 mr-2 text-purple-500" />
                          Virtual Store Inventory
                        </CardTitle>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowImportInventoryModal(true)}>
                              <Upload className="w-3 h-3 mr-1" /> Import
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAddInventoryModal(true)}>
                              <Plus className="w-3 h-3 mr-1" /> Add Item
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          <Input
                            placeholder="Search by SN, item code, or name..."
                            value={inventorySearch}
                            onChange={(e) => setInventorySearch(e.target.value)}
                            className="h-9 pl-8 text-sm"
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-2">
                        <p className="text-xs text-gray-500">
                          {filteredInventory.length} item{filteredInventory.length !== 1 ? 's' : ''}
                          {inventorySearch && storeInventory ? ` (filtered from ${storeInventory.length})` : ''}
                        </p>
                      </div>
                      {inventoryLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                        </div>
                      ) : filteredInventory.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          {storeInventory?.length === 0 ? 'No inventory items for this store' : 'No items match your search'}
                        </p>
                      ) : (
                        <div className="max-h-[300px] overflow-y-auto border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs py-2">SN</TableHead>
                                <TableHead className="text-xs py-2">Item Code</TableHead>
                                <TableHead className="text-xs py-2">Item Name</TableHead>
                                <TableHead className="text-xs py-2 text-right">Qty</TableHead>
                                {isAdmin && <TableHead className="text-xs py-2 w-10"></TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredInventory.map((item) => (
                                <TableRow key={item.inventoryId}>
                                  <TableCell className="text-xs py-1.5 font-mono">{item.sn || '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5">{item.kodeItem || '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 truncate max-w-[150px]">{item.namaBarang || '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{item.qty}</TableCell>
                                  {isAdmin && (
                                    <TableCell className="text-xs py-1.5">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteInventoryMutation.mutate(item.inventoryId)}
                                        disabled={deleteInventoryMutation.isPending}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Assign Discount Modal */}
      <Dialog open={showAssignDiscountModal} onOpenChange={setShowAssignDiscountModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Discount to Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Select Discount</label>
              <Select value={assigningDiscount} onValueChange={setAssigningDiscount}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a discount..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDiscountsForStore.map(d => (
                    <SelectItem key={d.discountId} value={d.discountId.toString()}>
                      {d.discountName} ({d.discountType === 'percentage' ? `${d.discountAmount}%` : `Rp ${Number(d.discountAmount || 0).toLocaleString()}`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableDiscountsForStore.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">All discounts are already assigned to this store</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAssignDiscountModal(false); setAssigningDiscount(""); }}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignDiscount}
                disabled={!assigningDiscount || assignDiscountMutation.isPending}
              >
                {assignDiscountMutation.isPending ? "Assigning..." : "Assign Discount"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign EDC Modal */}
      <Dialog open={showAssignEdcModal} onOpenChange={setShowAssignEdcModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method to Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Select Payment Method</label>
              <Select value={assigningEdcId} onValueChange={setAssigningEdcId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a payment method..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEdcsForStore.map(e => (
                    <SelectItem key={e.edcId} value={e.edcId.toString()}>
                      {e.merchantName} - {e.edcType}{e.edcKey ? ` [${e.edcKey}]` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableEdcsForStore.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">All payment methods are already assigned to this store</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAssignEdcModal(false); setAssigningEdcId(""); }}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignEdc}
                disabled={!assigningEdcId || assignEdcMutation.isPending}
              >
                {assignEdcMutation.isPending ? "Adding..." : "Add Payment Method"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Discount Confirmation */}
      <AlertDialog open={!!removingDiscount} onOpenChange={(open) => !open && setRemovingDiscount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Discount</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{removingDiscount?.discountName}" from this store? This won't delete the discount itself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => removingDiscount && removeDiscountMutation.mutate(removingDiscount.storeDiscountsId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove EDC Confirmation */}
      <AlertDialog open={!!removingEdc} onOpenChange={(open) => !open && setRemovingEdc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{removingEdc?.merchantName}" from this store?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => removingEdc && removeEdcMutation.mutate(removingEdc.storeEdcId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Inventory Item Modal */}
      <Dialog open={showAddInventoryModal} onOpenChange={setShowAddInventoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">SN *</Label>
              <Input
                value={newInventoryItem.sn}
                onChange={(e) => setNewInventoryItem(prev => ({ ...prev, sn: e.target.value }))}
                placeholder="Serial number"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Item Code</Label>
              <Input
                value={newInventoryItem.kodeItem}
                onChange={(e) => setNewInventoryItem(prev => ({ ...prev, kodeItem: e.target.value }))}
                placeholder="Item code"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">SC</Label>
              <Input
                value={newInventoryItem.sc}
                onChange={(e) => setNewInventoryItem(prev => ({ ...prev, sc: e.target.value }))}
                placeholder="SC"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Item Name</Label>
              <Input
                value={newInventoryItem.namaBarang}
                onChange={(e) => setNewInventoryItem(prev => ({ ...prev, namaBarang: e.target.value }))}
                placeholder="Item name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Quantity</Label>
              <Input
                type="number"
                min={1}
                value={newInventoryItem.qty}
                onChange={(e) => setNewInventoryItem(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAddInventoryModal(false); setNewInventoryItem({ sn: "", kodeItem: "", sc: "", namaBarang: "", qty: 1 }); }}>
                Cancel
              </Button>
              <Button
                onClick={handleAddInventoryItem}
                disabled={createInventoryMutation.isPending}
              >
                {createInventoryMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Inventory Modal */}
      <Dialog open={showImportInventoryModal} onOpenChange={setShowImportInventoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Inventory from File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Select File (Excel/CSV)</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              {importFile && (
                <p className="text-xs text-gray-500 mt-1">Selected: {importFile.name}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowImportInventoryModal(false); setImportFile(null); }}>
                Cancel
              </Button>
              <Button
                onClick={handleInventoryFileUpload}
                disabled={!importFile || isUploading}
              >
                {isUploading ? "Uploading..." : "Upload & Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}