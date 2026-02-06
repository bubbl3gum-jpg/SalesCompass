import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useStoreAuth } from "@/hooks/useStoreAuth";

import { Sidebar } from "@/components/sidebar";
import { ImportModal } from "@/components/import-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const discountFormSchema = z.object({
  discountName: z.string().min(1, "Discount name is required"),
  discountType: z.enum(["percentage", "amount"], {
    required_error: "Please select a discount type",
  }),
  discountAmount: z.coerce.number().min(0.01, "Discount amount must be greater than 0"),
  startFrom: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
});

type DiscountFormData = z.infer<typeof discountFormSchema>;

export default function Discounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useStoreAuth();
  
  const canUpdateDiscounts = hasPermission("discount:update");
  const [activeTab, setActiveTab] = useState<"types" | "stores">("stores");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingDiscount, setEditingDiscount] = useState<any>(null);
  const [deletingDiscount, setDeletingDiscount] = useState<any>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningStore, setAssigningStore] = useState<string>('');
  const [assigningDiscount, setAssigningDiscount] = useState<string>('');
  const [removingAssignment, setRemovingAssignment] = useState<any>(null);

  const form = useForm<DiscountFormData>({
    resolver: zodResolver(discountFormSchema),
    defaultValues: {
      discountName: "",
      discountType: "percentage" as const,
      discountAmount: 0,
      startFrom: "",
      endAt: "",
    },
  });

  const { data: discounts, isLoading: discountsLoading } = useQuery({
    queryKey: ["/api/discounts"],
    retry: false,
  });

  const { data: storesData } = useQuery({
    queryKey: ["/api/stores"],
  });

  const { data: storeDiscountsData, isLoading: storeDiscountsLoading } = useQuery({
    queryKey: ["/api/store-discounts"],
  });

  const filteredDiscounts = Array.isArray(discounts) ? discounts.filter((discount: any) => {
    if (!discount.discountName) return false;
    if (!searchTerm) return true;
    return discount.discountName.toLowerCase().includes(searchTerm.toLowerCase());
  }) : [];

  const storesArray = Array.isArray(storesData) ? storesData : [];
  const storeDiscountsArray = Array.isArray(storeDiscountsData) ? storeDiscountsData : [];

  const storeDiscountMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    storeDiscountsArray.forEach((sd: any) => {
      if (!map[sd.kodeGudang]) {
        map[sd.kodeGudang] = [];
      }
      map[sd.kodeGudang].push(sd);
    });
    return map;
  }, [storeDiscountsArray]);

  const isSupervisor = user?.role === 'Supervisor';
  const userStore = user?.store_id;

  const filteredStores = useMemo(() => {
    let stores = storesArray;
    if (isSupervisor && userStore) {
      stores = stores.filter((s: any) => s.kodeGudang === userStore);
    }
    if (searchTerm && activeTab === 'stores') {
      stores = stores.filter((s: any) =>
        s.namaGudang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.kodeGudang?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return stores;
  }, [storesArray, isSupervisor, userStore, searchTerm, activeTab]);

  const createDiscountMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/discounts', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Discount created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      form.reset();
      setShowDiscountModal(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.replace("/api/login"); }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create discount", variant: "destructive" });
    },
  });

  const updateDiscountMutation = useMutation({
    mutationFn: async ({ discountId, data }: { discountId: number, data: any }) => {
      const response = await apiRequest('PUT', `/api/discounts/${discountId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Discount updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      form.reset();
      setEditingDiscount(null);
      setShowDiscountModal(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.replace("/api/login"); }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update discount", variant: "destructive" });
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (discountId: number) => {
      const response = await apiRequest('DELETE', `/api/discounts/${discountId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Discount deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      setDeletingDiscount(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.replace("/api/login"); }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete discount", variant: "destructive" });
    },
  });

  const assignDiscountMutation = useMutation({
    mutationFn: async (data: { kodeGudang: string; discountId: string }) => {
      const response = await apiRequest('POST', '/api/store-discounts', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Discount assigned to store" });
      queryClient.invalidateQueries({ queryKey: ["/api/store-discounts"] });
      setShowAssignModal(false);
      setAssigningStore('');
      setAssigningDiscount('');
    },
    onError: (error: any) => {
      const message = error?.message?.includes('409') || error?.message?.includes('already')
        ? "This discount is already assigned to this store"
        : "Failed to assign discount";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/store-discounts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Discount removed from store" });
      queryClient.invalidateQueries({ queryKey: ["/api/store-discounts"] });
      setRemovingAssignment(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove discount", variant: "destructive" });
    },
  });

  const onSubmit = (data: DiscountFormData) => {
    if (editingDiscount) {
      updateDiscountMutation.mutate({ discountId: editingDiscount.discountId, data });
    } else {
      createDiscountMutation.mutate(data);
    }
  };

  const handleEditDiscount = (discount: any) => {
    setEditingDiscount(discount);
    form.reset({
      discountName: discount.discountName || "",
      discountType: discount.discountType || "percentage",
      discountAmount: parseFloat(discount.discountAmount || "0"),
      startFrom: discount.startFrom || "",
      endAt: discount.endAt || "",
    });
    setShowDiscountModal(true);
  };

  const getDiscountStatus = (discount: any) => {
    const now = new Date();
    const startDate = new Date(discount.startFrom);
    const endDate = new Date(discount.endAt);
    if (now < startDate) {
      return { status: 'Upcoming', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' };
    } else if (now > endDate) {
      return { status: 'Expired', color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300' };
    } else {
      return { status: 'Active', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };
    }
  };

  const formatDiscountLabel = (d: any) => {
    if (!d) return '';
    const amount = parseFloat(d.discountAmount || '0');
    return d.discountType === 'percentage' ? `${amount}%` : `Rp${amount.toLocaleString('id-ID')}`;
  };

  const getAvailableDiscountsForStore = (kodeGudang: string) => {
    const assignedIds = (storeDiscountMap[kodeGudang] || []).map((sd: any) => sd.discountId);
    return Array.isArray(discounts) ? discounts.filter((d: any) => d.discountName && !assignedIds.includes(d.discountId)) : [];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Discount Management</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {activeTab === 'types' ? 'Create and manage discount types' : 'Assign discounts to stores'}
              </p>
            </div>
            <div className="flex space-x-3">
              {canUpdateDiscounts && activeTab === 'types' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowImportModal(true)}
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    data-testid="button-import-discounts"
                  >
                    <i className="fas fa-upload mr-2"></i>
                    Import
                  </Button>
                  <Button
                    onClick={() => setShowDiscountModal(true)}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    data-testid="button-new-discount"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    New Discount
                  </Button>
                </>
              )}
              {canUpdateDiscounts && activeTab === 'stores' && (
                <Button
                  onClick={() => setShowAssignModal(true)}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700"
                  data-testid="button-assign-discount"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Assign Discount to Store
                </Button>
              )}
              {!canUpdateDiscounts && (
                <Badge variant="secondary" className="px-3 py-1">
                  Read Only Access
                </Badge>
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-white/20 dark:bg-black/20 backdrop-blur-xl rounded-lg p-1 w-fit border border-white/20 dark:border-gray-800/50">
            <button
              onClick={() => { setActiveTab('stores'); setSearchTerm(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'stores'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              data-testid="tab-store-discounts"
            >
              <i className="fas fa-store mr-2"></i>
              Store Discounts
            </button>
            <button
              onClick={() => { setActiveTab('types'); setSearchTerm(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'types'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              data-testid="tab-discount-types"
            >
              <i className="fas fa-percentage mr-2"></i>
              Discount Types
            </button>
          </div>

          {/* Search */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder={activeTab === 'types' ? "Search discount by name..." : "Search store by name or code..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/50 dark:bg-gray-800/50"
                    data-testid="input-search-discounts"
                  />
                </div>
                <Button variant="outline" onClick={() => setSearchTerm('')} data-testid="button-clear-search">
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Store Discounts Tab */}
          {activeTab === 'stores' && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  Store Discount Assignments
                  <span className="ml-2 text-sm text-gray-500 font-normal">({filteredStores.length} stores)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {storeDiscountsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                        <Skeleton className="w-40 h-5 mb-3" />
                        <div className="flex gap-2">
                          <Skeleton className="w-24 h-6 rounded-full" />
                          <Skeleton className="w-24 h-6 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredStores.length > 0 ? (
                  <div className="space-y-4">
                    {filteredStores.map((store: any) => {
                      const storeAssignments = storeDiscountMap[store.kodeGudang] || [];
                      return (
                        <div
                          key={store.kodeGudang}
                          className="p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                          data-testid={`store-discount-row-${store.kodeGudang}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <i className="fas fa-store text-white text-sm"></i>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{store.namaGudang || store.kodeGudang}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{store.kodeGudang}</p>
                              </div>
                            </div>
                            {canUpdateDiscounts && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAssigningStore(store.kodeGudang);
                                  setAssigningDiscount('');
                                  setShowAssignModal(true);
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                                data-testid={`button-add-discount-${store.kodeGudang}`}
                              >
                                <i className="fas fa-plus mr-1"></i> Add
                              </Button>
                            )}
                          </div>
                          
                          {storeAssignments.length > 0 ? (
                            <div className="flex flex-wrap gap-2 ml-13">
                              {storeAssignments.map((sd: any) => {
                                const statusInfo = sd.startFrom && sd.endAt ? getDiscountStatus(sd) : null;
                                return (
                                  <div
                                    key={sd.storeDiscountsId}
                                    className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full px-3 py-1"
                                  >
                                    <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                      {sd.discountName || 'Discount'} ({formatDiscountLabel(sd)})
                                    </span>
                                    {statusInfo && (
                                      <Badge className={`${statusInfo.color} border-0 text-xs px-1.5 py-0`}>
                                        {statusInfo.status}
                                      </Badge>
                                    )}
                                    {canUpdateDiscounts && (
                                      <button
                                        onClick={() => setRemovingAssignment(sd)}
                                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-1"
                                        data-testid={`button-remove-assignment-${sd.storeDiscountsId}`}
                                      >
                                        <i className="fas fa-times text-xs"></i>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 ml-13 italic">No discounts assigned</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-store text-white text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {searchTerm ? 'No matching stores' : 'No stores found'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'Try a different search term.' : 'Add stores first to assign discounts.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Discount Types Tab */}
          {activeTab === 'types' && (
            <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  Discount Types
                  {filteredDiscounts && <span className="ml-2 text-sm text-gray-500">({filteredDiscounts.length} discounts)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {discountsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl">
                          <div className="flex items-center space-x-4">
                            <Skeleton className="w-12 h-12 rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="w-32 h-4" />
                              <Skeleton className="w-24 h-3" />
                              <Skeleton className="w-40 h-3" />
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Skeleton className="w-16 h-4" />
                            <Skeleton className="w-20 h-6 rounded-full" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredDiscounts.length > 0 ? (
                  <div className="space-y-4">
                    {filteredDiscounts.map((discount: any) => {
                      const status = getDiscountStatus(discount);
                      const assignedStores = storeDiscountsArray.filter((sd: any) => sd.discountId === discount.discountId);
                      return (
                        <div
                          key={discount.discountId}
                          className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                          data-testid={`card-discount-${discount.discountId}`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                              <i className="fas fa-percentage text-white"></i>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {discount.discountName}
                              </p>
                              <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                                {discount.discountType === 'percentage' ? `${parseFloat(discount.discountAmount || '0')}% OFF` : `Rp${parseFloat(discount.discountAmount || '0').toLocaleString('id-ID')} OFF`}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {discount.startFrom} to {discount.endAt}
                              </p>
                              {assignedStores.length > 0 && (
                                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                                  <i className="fas fa-store mr-1"></i>
                                  Assigned to {assignedStores.length} store{assignedStores.length > 1 ? 's' : ''}: {assignedStores.map((s: any) => s.namaGudang || s.kodeGudang).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <Badge className={`${status.color} border-0`}>
                              {status.status}
                            </Badge>
                            {canUpdateDiscounts ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditDiscount(discount)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                  data-testid={`button-edit-discount-${discount.discountId}`}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingDiscount(discount)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                  data-testid={`button-delete-discount-${discount.discountId}`}
                                >
                                  Delete
                                </Button>
                              </>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Read Only</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-percentage text-white text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {searchTerm ? 'No matching discounts' : 'No discounts configured'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {searchTerm ? 'No discounts match your search criteria.' : canUpdateDiscounts ? 'Start by creating discount types for your promotions.' : 'No discount types have been configured yet.'}
                    </p>
                    {canUpdateDiscounts && !searchTerm && (
                      <Button
                        onClick={() => setShowDiscountModal(true)}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                        data-testid="button-create-first-discount"
                      >
                        Create First Discount
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* New/Edit Discount Modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {editingDiscount ? 'Edit Discount' : 'Create New Discount'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="discountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter discount name" {...field} data-testid="input-discount-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-discount-type">
                          <SelectValue placeholder="Select discount type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="amount">Fixed Amount (Rp)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("discountType") === "percentage" ? "Discount Percentage (%)" : "Discount Amount (Rp)"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max={form.watch("discountType") === "percentage" ? "100" : undefined}
                        placeholder={form.watch("discountType") === "percentage" ? "10" : "50000"} 
                        step={form.watch("discountType") === "percentage" ? "1" : "0.01"}
                        {...field} 
                        data-testid="input-discount-amount" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDiscountModal(false);
                    setEditingDiscount(null);
                    form.reset();
                  }}
                  data-testid="button-cancel-discount"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  disabled={createDiscountMutation.isPending || updateDiscountMutation.isPending}
                  data-testid="button-save-discount"
                >
                  {editingDiscount ? 
                    (updateDiscountMutation.isPending ? "Updating..." : "Update Discount") :
                    (createDiscountMutation.isPending ? "Creating..." : "Create Discount")
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign Discount to Store Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Assign Discount to Store
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Select Store</label>
              <Select value={assigningStore} onValueChange={setAssigningStore}>
                <SelectTrigger data-testid="select-assign-store">
                  <SelectValue placeholder="Choose a store" />
                </SelectTrigger>
                <SelectContent>
                  {storesArray.map((store: any) => (
                    <SelectItem key={store.kodeGudang} value={store.kodeGudang}>
                      {store.namaGudang || store.kodeGudang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Select Discount</label>
              <Select value={assigningDiscount} onValueChange={setAssigningDiscount}>
                <SelectTrigger data-testid="select-assign-discount">
                  <SelectValue placeholder="Choose a discount" />
                </SelectTrigger>
                <SelectContent>
                  {assigningStore ? (
                    getAvailableDiscountsForStore(assigningStore).length > 0 ? (
                      getAvailableDiscountsForStore(assigningStore).map((d: any) => (
                        <SelectItem key={d.discountId} value={d.discountId.toString()}>
                          {d.discountName} ({formatDiscountLabel(d)})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none" disabled>All discounts already assigned</SelectItem>
                    )
                  ) : (
                    <SelectItem value="__none" disabled>Select a store first</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningStore('');
                  setAssigningDiscount('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (assigningStore && assigningDiscount) {
                    assignDiscountMutation.mutate({ kodeGudang: assigningStore, discountId: assigningDiscount });
                  }
                }}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700"
                disabled={!assigningStore || !assigningDiscount || assignDiscountMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignDiscountMutation.isPending ? "Assigning..." : "Assign Discount"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Discount Data"
        tableName="discounts"
        queryKey="/api/discounts"
        endpoint="/api/import"
        sampleData={[
          'discountName',
          'discountAmount',
          'startFrom (YYYY-MM-DD)',
          'endAt (YYYY-MM-DD)'
        ]}
      />

      {/* Delete Discount Confirmation */}
      <AlertDialog open={!!deletingDiscount} onOpenChange={(open) => !open && setDeletingDiscount(null)}>
        <AlertDialogContent className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Delete Discount</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-300">
              Are you sure you want to delete the discount "{deletingDiscount?.discountName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeletingDiscount(null)}
              className="border-gray-300 dark:border-gray-600"
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingDiscount && deleteDiscountMutation.mutate(deletingDiscount.discountId)}
              disabled={deleteDiscountMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              {deleteDiscountMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Assignment Confirmation */}
      <AlertDialog open={!!removingAssignment} onOpenChange={(open) => !open && setRemovingAssignment(null)}>
        <AlertDialogContent className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Remove Discount from Store</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-300">
              Are you sure you want to remove "{removingAssignment?.discountName}" from this store? Staff at this store will no longer be able to apply this discount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 dark:border-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => removingAssignment && removeAssignmentMutation.mutate(removingAssignment.storeDiscountsId)}
              disabled={removeAssignmentMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-remove"
            >
              {removeAssignmentMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
