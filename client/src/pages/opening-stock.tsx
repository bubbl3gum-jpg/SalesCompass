import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useStoreAuth } from "@/hooks/useStoreAuth";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit3, Trash2, Plus, Upload, Download } from "lucide-react";

const openingStockFormSchema = z.object({
  sn: z.string().optional(),
  kodeItem: z.string().min(1, "Kode Item is required"),
  kelompok: z.string().optional(),
  family: z.string().optional(),
  deskripsiMaterial: z.string().optional(),
  kodeMotif: z.string().optional(),
  namaItem: z.string().min(1, "Nama Item is required"),
  qty: z.coerce.number().min(0, "Quantity must be 0 or greater"),
});

type OpeningStockFormData = z.infer<typeof openingStockFormSchema>;

const importModalFormSchema = z.object({
  importData: z.string().min(1, "Import data is required"),
  mode: z.enum(["amend", "replace"], {
    required_error: "Please select an import mode",
  }),
});

type ImportModalFormData = z.infer<typeof importModalFormSchema>;

export default function OpeningStock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useStoreAuth();
  
  // Check if user can manage opening stock (supervisors only)
  const canReadOpeningStock = hasPermission("opening_stock:read");
  const canCreateOpeningStock = hasPermission("opening_stock:create");
  const canUpdateOpeningStock = hasPermission("opening_stock:update");
  const canDeleteOpeningStock = hasPermission("opening_stock:delete");
  
  const [showStockModal, setShowStockModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingStock, setEditingStock] = useState<any>(null);
  const [deletingStock, setDeletingStock] = useState<any>(null);

  const form = useForm<OpeningStockFormData>({
    resolver: zodResolver(openingStockFormSchema),
    defaultValues: {
      sn: "",
      kodeItem: "",
      kelompok: "",
      family: "",
      deskripsiMaterial: "",
      kodeMotif: "",
      namaItem: "",
      qty: 0,
    },
  });

  const importForm = useForm<ImportModalFormData>({
    resolver: zodResolver(importModalFormSchema),
    defaultValues: {
      importData: "",
      mode: "amend",
    },
  });

  // Get opening stock
  const { data: openingStock, isLoading: stockLoading } = useQuery({
    queryKey: ["/api/opening-stock"],
    retry: false,
    enabled: canReadOpeningStock,
  });

  // Filter opening stock based on search
  const filteredStock = Array.isArray(openingStock) ? openingStock.filter((stock: any) => {
    if (!searchTerm) return true;
    return (
      stock.kodeItem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.namaItem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.sn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.kelompok?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.family?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) : [];

  // Create opening stock mutation
  const createStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/opening-stock', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Opening stock item created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opening-stock"] });
      form.reset();
      setShowStockModal(false);
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
        description: "Failed to create opening stock item",
        variant: "destructive",
      });
    },
  });

  // Update opening stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', `/api/opening-stock/${editingStock.itemId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Opening stock item updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opening-stock"] });
      form.reset();
      setEditingStock(null);
      setShowStockModal(false);
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
        description: "Failed to update opening stock item",
        variant: "destructive",
      });
    },
  });

  // Delete opening stock mutation
  const deleteStockMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest('DELETE', `/api/opening-stock/${itemId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Opening stock item deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opening-stock"] });
      setDeletingStock(null);
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
        description: "Failed to delete opening stock item",
        variant: "destructive",
      });
    },
  });

  // Import opening stock mutation
  const importStockMutation = useMutation({
    mutationFn: async (data: { data: any[], mode: string }) => {
      const response = await apiRequest('POST', '/api/opening-stock/import', data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Import Complete",
        description: `Successfully processed ${result.success} items. ${result.errors?.length || 0} errors.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opening-stock"] });
      importForm.reset();
      setShowImportModal(false);
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import opening stock data",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: OpeningStockFormData) => {
    if (editingStock) {
      updateStockMutation.mutate(data);
    } else {
      createStockMutation.mutate(data);
    }
  };

  const handleEdit = (stock: any) => {
    setEditingStock(stock);
    form.reset({
      sn: stock.sn || "",
      kodeItem: stock.kodeItem || "",
      kelompok: stock.kelompok || "",
      family: stock.family || "",
      deskripsiMaterial: stock.deskripsiMaterial || "",
      kodeMotif: stock.kodeMotif || "",
      namaItem: stock.namaItem || "",
      qty: stock.qty || 0,
    });
    setShowStockModal(true);
  };

  const handleDelete = (stock: any) => {
    setDeletingStock(stock);
  };

  const handleImport = (data: ImportModalFormData) => {
    try {
      // Parse CSV-like data
      const lines = data.importData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      const importData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const item: any = {};
        headers.forEach((header, index) => {
          if (header === 'qty') {
            item[header] = parseInt(values[index]) || 0;
          } else {
            item[header] = values[index] || null;
          }
        });
        return item;
      });

      importStockMutation.mutate({ data: importData, mode: data.mode });
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Invalid data format. Please check your input.",
        variant: "destructive",
      });
    }
  };

  // If user doesn't have permission to read opening stock, show access denied
  if (!canReadOpeningStock) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You don't have permission to access opening stock management.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50" data-testid="opening-stock-page">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Opening Stock Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="stock-list" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stock-list">Stock List</TabsTrigger>
                  <TabsTrigger value="import">Import</TabsTrigger>
                </TabsList>

                <TabsContent value="stock-list" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search stock items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                        data-testid="input-search"
                      />
                    </div>
                    <div className="flex gap-2">
                      {canCreateOpeningStock && (
                        <Button 
                          onClick={() => {
                            setEditingStock(null);
                            form.reset();
                            setShowStockModal(true);
                          }}
                          data-testid="button-add-stock"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Stock Item
                        </Button>
                      )}
                      {canCreateOpeningStock && (
                        <Button 
                          variant="outline"
                          onClick={() => setShowImportModal(true)}
                          data-testid="button-import"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Import
                        </Button>
                      )}
                    </div>
                  </div>

                  {stockLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredStock.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No opening stock items found.
                        </div>
                      ) : (
                        <div className="border rounded-lg">
                          <div className="grid grid-cols-8 gap-4 p-4 font-medium border-b bg-muted/50">
                            <div>Serial Number</div>
                            <div>Kode Item</div>
                            <div>Nama Item</div>
                            <div>Kelompok</div>
                            <div>Family</div>
                            <div>Quantity</div>
                            <div>Material</div>
                            <div>Actions</div>
                          </div>
                          {filteredStock.map((stock: any) => (
                            <div key={stock.itemId} className="grid grid-cols-8 gap-4 p-4 border-b hover:bg-muted/50">
                              <div className="truncate">{stock.sn || '-'}</div>
                              <div className="truncate">{stock.kodeItem || '-'}</div>
                              <div className="truncate">{stock.namaItem || '-'}</div>
                              <div className="truncate">{stock.kelompok || '-'}</div>
                              <div className="truncate">{stock.family || '-'}</div>
                              <div>
                                <Badge variant="secondary">
                                  {stock.qty || 0}
                                </Badge>
                              </div>
                              <div className="truncate">{stock.deskripsiMaterial || '-'}</div>
                              <div className="flex gap-2">
                                {canUpdateOpeningStock && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(stock)}
                                    data-testid={`button-edit-${stock.itemId}`}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDeleteOpeningStock && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete(stock)}
                                    className="hover:bg-destructive hover:text-destructive-foreground"
                                    data-testid={`button-delete-${stock.itemId}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="import" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Import Opening Stock Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Form {...importForm}>
                        <form onSubmit={importForm.handleSubmit(handleImport)} className="space-y-4">
                          <FormField
                            control={importForm.control}
                            name="mode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Import Mode</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-import-mode">
                                      <SelectValue placeholder="Select import mode" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="amend">Amend/Add (Update existing, add new)</SelectItem>
                                    <SelectItem value="replace">Replace (Clear all existing data)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={importForm.control}
                            name="importData"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CSV Data</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Paste CSV data here (kodeItem,namaItem,qty,sn,kelompok,family,deskripsiMaterial,kodeMotif)&#10;ITEM001,Item Name 1,10,SN001,Group1,Family1,Material1,Motif1&#10;ITEM002,Item Name 2,5,SN002,Group2,Family2,Material2,Motif2"
                                    className="min-h-40"
                                    {...field}
                                    data-testid="textarea-import-data"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit" 
                            disabled={importStockMutation.isPending}
                            data-testid="button-submit-import"
                          >
                            {importStockMutation.isPending ? "Importing..." : "Import Data"}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Stock Modal */}
      <Dialog open={showStockModal} onOpenChange={setShowStockModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingStock ? "Edit Opening Stock Item" : "Add Opening Stock Item"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="kodeItem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode Item *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-kode-item" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="namaItem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Item *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-nama-item" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-sn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="qty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-qty" />
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
                        <Input {...field} data-testid="input-kelompok" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="family"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Family</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-family" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="deskripsiMaterial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deskripsi Material</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-deskripsi-material" />
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
                      <FormLabel>Kode Motif</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-kode-motif" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowStockModal(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createStockMutation.isPending || updateStockMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingStock ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingStock} onOpenChange={() => setDeletingStock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opening Stock Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this opening stock item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingStock && deleteStockMutation.mutate(deletingStock.itemId)}
              disabled={deleteStockMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}