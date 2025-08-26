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
  discountAmount: z.string().min(1, "Discount amount is required"),
  startFrom: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
});

type DiscountFormData = z.infer<typeof discountFormSchema>;

export default function Discounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const form = useForm<DiscountFormData>({
    resolver: zodResolver(discountFormSchema),
    defaultValues: {
      discountName: "",
      discountType: "percentage" as const,
      discountAmount: "",
      startFrom: "",
      endAt: "",
    },
  });

  // Get discounts
  const { data: discounts, isLoading: discountsLoading } = useQuery({
    queryKey: ["/api/discounts"],
    retry: false,
  });

  // Filter discounts based on search
  const filteredDiscounts = Array.isArray(discounts) ? discounts.filter((discount: any) => 
    discount.discountName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Create discount mutation
  const createDiscountMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/discounts', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Discount created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      form.reset();
      setShowDiscountModal(false);
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
        description: "Failed to create discount",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DiscountFormData) => {
    const submitData = {
      ...data,
      discountAmount: parseFloat(data.discountAmount),
    };
    createDiscountMutation.mutate(submitData);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        {/* Header */}
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Discount Management</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage discount types and promotions</p>
            </div>
            <div className="flex space-x-3">
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
                    placeholder="Search discount by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/50 dark:bg-gray-800/50"
                    data-testid="input-search-discounts"
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

          {/* Discounts List */}
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
                              {parseFloat(discount.discountAmount || '0')}% OFF
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {discount.startFrom} to {discount.endAt}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Badge className={`${status.color} border-0`}>
                            {status.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            data-testid={`button-edit-discount-${discount.discountId}`}
                          >
                            Edit
                          </Button>
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
                    {searchTerm ? 'No discounts match your search criteria.' : 'Start by creating discount types for your promotions.'}
                  </p>
                  <Button
                    onClick={() => setShowDiscountModal(true)}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    data-testid="button-create-first-discount"
                  >
                    Create First Discount
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* New Discount Modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent className="max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Create New Discount
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
                        <SelectItem value="amount">Fixed Amount ($)</SelectItem>
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
                      {form.watch("discountType") === "percentage" ? "Discount Percentage (%)" : "Discount Amount ($)"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max={form.watch("discountType") === "percentage" ? "100" : undefined}
                        placeholder={form.watch("discountType") === "percentage" ? "10" : "5.00"} 
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
                  onClick={() => setShowDiscountModal(false)}
                  data-testid="button-cancel-discount"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  disabled={createDiscountMutation.isPending}
                  data-testid="button-save-discount"
                >
                  {createDiscountMutation.isPending ? "Creating..." : "Create Discount"}
                </Button>
              </div>
            </form>
          </Form>
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
    </div>
  );
}
