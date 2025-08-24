import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const pricelistFormSchema = z.object({
  serialNumber: z.string().optional(),
  kodeItem: z.string().min(1, "Item code is required"),
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
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  // Get pricelist
  const { data: pricelist, isLoading: pricelistLoading } = useQuery({
    queryKey: ["/api/pricelist"],
    retry: false,
  });

  // Get reference sheets for item lookup
  const { data: referenceSheets } = useQuery({
    queryKey: ["/api/reference-sheets"],
    retry: false,
  });

  // Filter pricelist based on search
  const filteredPricelist = pricelist?.filter((item: any) => 
    item.kodeItem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.family?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.deskripsiMaterial?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
          window.location.href = "/api/login";
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
                className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50"
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
                {filteredPricelist && <span className="ml-2 text-sm text-gray-500">({filteredPricelist.length} items)</span>}
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
              ) : filteredPricelist.length > 0 ? (
                <div className="space-y-4">
                  {filteredPricelist.map((price: any) => (
                    <div
                      key={price.pricelistId}
                      className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                      data-testid={`card-price-${price.pricelistId}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-tag text-white"></i>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {price.kodeItem}
                          </p>
                          {price.serialNumber && (
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              Serial: {price.serialNumber}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 mt-1">
                            {price.family && (
                              <Badge variant="outline" className="text-xs">
                                {price.family}
                              </Badge>
                            )}
                            {price.kelompok && (
                              <Badge variant="outline" className="text-xs">
                                {price.kelompok}
                              </Badge>
                            )}
                          </div>
                          {price.deskripsiMaterial && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {price.deskripsiMaterial}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatPrice(price.normalPrice)}
                        </p>
                        {price.sp && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-400">
                            SP: {formatPrice(price.sp)}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-2"
                          data-testid={`button-edit-price-${price.pricelistId}`}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
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
                    {searchTerm ? 'No price list items match your search criteria.' : 'Start by adding price list items for your products.'}
                  </p>
                  <Button
                    onClick={() => setShowPriceModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    data-testid="button-add-first-price"
                  >
                    Add First Price
                  </Button>
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
    </div>
  );
}
