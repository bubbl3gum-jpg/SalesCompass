import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useStoreAuth } from "@/hooks/useStoreAuth";

import { Sidebar } from "@/components/sidebar";
import { PricelistImportModal } from "@/components/PricelistImportModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper function to format price
function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numPrice);
}

const pricelistFormSchema = z.object({
  serialNumber: z.string().optional(),
  kodeItem: z.string().optional(),
  kelompok: z.string().optional(),
  family: z.string().optional(),
  kodeMaterial: z.string().optional(),
  kodeMotif: z.string().optional(),
  deskripsiMaterial: z.string().optional(),
  normalPrice: z.string().min(1, "Normal price is required"),
  sp: z.string().optional(),
});

type PricelistFormData = z.infer<typeof pricelistFormSchema>;

export default function PriceLists() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useStoreAuth();
  
  // Check if user can update pricelists
  const canUpdatePricelists = hasPermission("pricelist:update");
  
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Helper function to invalidate and refetch price list data
  const refreshPricelistData = useCallback(async () => {
    console.log('🔄 Refreshing pricelist data...');
    
    // Clear all cached pricelist queries
    queryClient.removeQueries({ queryKey: ['/api/pricelist'] });
    queryClient.clear(); // Clear entire cache as a fallback
    
    // Also refresh the current query
    window.location.reload();
  }, [queryClient]);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const form = useForm<PricelistFormData>({
    resolver: zodResolver(pricelistFormSchema),
    defaultValues: {
      serialNumber: "",
      kodeItem: "",
      kelompok: "",
      family: "",
      kodeMaterial: "",
      kodeMotif: "",
      deskripsiMaterial: "",
      normalPrice: "",
      sp: "",
    },
  });

  // Get paginated pricelist
  const { data: pricelistResponse, isLoading: pricelistLoading } = useQuery({
    queryKey: ["/api/pricelist", currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm })
      });
      const response = await apiRequest('GET', `/api/pricelist?${params}`);
      return response.json();
    },
    retry: false,
  });

  // Get reference sheets for item lookup
  const { data: referenceSheets } = useQuery({
    queryKey: ["/api/reference-sheets"],
    retry: false,
  });

  const pricelist = pricelistResponse?.data || [];
  const pagination = pricelistResponse?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1
  };

  // Create pricelist item mutation
  const createPricelistMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/pricelist', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Price list item created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pricelist"] });
      form.reset();
      setShowPriceModal(false);
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
        description: "Failed to create price list item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PricelistFormData) => {
    const submitData = {
      ...data,
      normalPrice: parseFloat(data.normalPrice),
      sp: data.sp ? parseFloat(data.sp) : null,
    };
    createPricelistMutation.mutate(submitData);
  };

  const formatPrice = (price: any) => {
    if (!price) return '-';
    return `Rp ${parseFloat(price.toString()).toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Price Lists</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage product pricing and price resolution</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={refreshPricelistData}
                className="dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 text-gray-700 dark:text-gray-300"
                data-testid="button-refresh"
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Refresh
              </Button>
              {canUpdatePricelists && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowImportModal(true)}
                    className="dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 text-[#000000] bg-[#96e683de]"
                    data-testid="button-import-prices"
                  >
                    <i className="fas fa-upload mr-2"></i>
                    Import
                  </Button>
                  <Button
                    onClick={() => setShowPriceModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    data-testid="button-new-price"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Add Price
                  </Button>
                </>
              )}
              {!canUpdatePricelists && (
                <Badge variant="secondary" className="px-3 py-1">
                  Read Only Access
                </Badge>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Search */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by item code, serial, family, or material..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/50 dark:bg-gray-800/50"
                    data-testid="input-search-prices"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSearchTerm('')}
                  data-testid="button-clear-search"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Price List Table */}
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Price List Items
                {pagination && <span className="ml-2 text-sm text-gray-500">({pagination.total} total items)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pricelistLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 10 }).map((_, i) => (
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
                        <div className="text-right space-y-2">
                          <Skeleton className="w-20 h-4" />
                          <Skeleton className="w-16 h-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pricelist.length > 0 ? (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Family</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Motif</TableHead>
                        <TableHead className="text-right">Normal Price</TableHead>
                        <TableHead className="text-right">Special Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricelist.map((price: any) => (
                        <TableRow key={price.pricelistId}>
                          <TableCell className="font-medium">{price.kodeItem}</TableCell>
                          <TableCell className="text-blue-600 dark:text-blue-400">
                            {price.sn || '-'}
                          </TableCell>
                          <TableCell>
                            {price.family ? (
                              <Badge variant="outline" className="text-xs">
                                {price.family}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {price.kelompok ? (
                              <Badge variant="outline" className="text-xs">
                                {price.kelompok}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                            {price.deskripsiMaterial || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {price.namaMotif || price.kodeMotif || '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(price.normalPrice)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                            {price.sp ? formatPrice(price.sp) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {canUpdatePricelists ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                data-testid={`button-edit-price-${price.pricelistId}`}
                              >
                                Edit
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Read Only</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Show:</span>
                      <Select value={pageSize.toString()} onValueChange={(value) => {
                        setPageSize(parseInt(value));
                        setCurrentPage(1); // Reset to first page
                      }}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-500">
                        per page • Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} items
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else {
                            // Show pages around current page
                            const start = Math.max(1, currentPage - 2);
                            pageNum = start + i;
                          }
                          
                          if (pageNum > pagination.totalPages) return null;
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setCurrentPage(pageNum)}
                              data-testid={`button-page-${pageNum}`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                        disabled={currentPage >= pagination.totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-tag text-white text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {searchTerm ? 'No matching prices' : 'No prices configured'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchTerm ? 'No price list items match your search criteria.' : canUpdatePricelists ? 'Start by adding price list items for your products.' : 'No price list items have been configured yet.'}
                  </p>
                  {canUpdatePricelists && (
                    <Button
                      onClick={() => setShowPriceModal(true)}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                      data-testid="button-add-first-price"
                    >
                      Add First Price
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* New Price Modal */}
      <Dialog open={showPriceModal} onOpenChange={setShowPriceModal}>
        <DialogContent className="max-w-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Add Price List Item
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="kodeItem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter item code" {...field} data-testid="input-item-code" />
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
                        <Input placeholder="Enter serial number" {...field} data-testid="input-serial" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="family"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Family</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter family" {...field} data-testid="input-family" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kelompok"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kelompok</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter kelompok" {...field} data-testid="input-kelompok" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="deskripsiMaterial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter material description" {...field} data-testid="input-material-desc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="kodeMaterial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter material code" {...field} data-testid="input-material-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kodeMotif"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter motif code" {...field} data-testid="input-motif-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="normalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Normal Price *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} data-testid="input-normal-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Price</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} data-testid="input-special-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPriceModal(false)}
                  data-testid="button-cancel-price"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  disabled={createPricelistMutation.isPending}
                  data-testid="button-save-price"
                >
                  {createPricelistMutation.isPending ? "Saving..." : "Save Price"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Pricelist Import Modal */}
      <PricelistImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onComplete={() => {
          refreshPricelistData();
          setShowImportModal(false);
        }}
      />
    </div>
  );
}
