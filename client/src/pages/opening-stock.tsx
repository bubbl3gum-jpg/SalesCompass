import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";

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
import { Edit3, Trash2, Plus, Upload, Download, FileSpreadsheet } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";

const openingStockFormSchema = z.object({
  sn: z.string().optional(),
  kodeItem: z.string().min(1, "Kode Item is required"),
  namaItem: z.string().optional(),
  qty: z.coerce.number().min(0, "Quantity must be 0 or greater"),
});

type OpeningStockFormData = z.infer<typeof openingStockFormSchema>;

const importModalFormSchema = z.object({
  mode: z.enum(["amend", "replace"], {
    required_error: "Please select an import mode",
  }),
});

type ImportModalFormData = z.infer<typeof importModalFormSchema>;

export default function OpeningStock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useStoreAuth();
  const { isExpanded } = useSidebar();
  
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
  const [enrichedItemData, setEnrichedItemData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const form = useForm<OpeningStockFormData>({
    resolver: zodResolver(openingStockFormSchema),
    defaultValues: {
      sn: "",
      kodeItem: "",
      namaItem: "",
      qty: 0,
    },
  });

  const importForm = useForm<ImportModalFormData>({
    resolver: zodResolver(importModalFormSchema),
    defaultValues: {
      mode: "amend",
    },
  });

  // Get opening stock
  const { data: openingStock, isLoading: stockLoading } = useQuery({
    queryKey: ["/api/opening-stock"],
    retry: false,
    enabled: canReadOpeningStock,
  });

  // Get reference sheet for auto-enrichment
  const { data: referenceSheet } = useQuery({
    queryKey: ['/api/reference-sheet'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  }) as { data: any[] | undefined };

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
          window.location.replace("/api/login");
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
          window.location.replace("/api/login");
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
          window.location.replace("/api/login");
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
      namaItem: stock.namaItem || "",
      qty: stock.qty || 0,
    });
    setShowStockModal(true);
  };

  const handleDelete = (stock: any) => {
    setDeletingStock(stock);
  };

  // Auto-lookup reference data when kodeItem changes
  const handleItemCodeChange = (kodeItem: string) => {
    if (kodeItem && Array.isArray(referenceSheet)) {
      const referenceData = referenceSheet.find((ref: any) => 
        ref.kodeItem === kodeItem || ref.sn === kodeItem
      );
      if (referenceData) {
        setEnrichedItemData(referenceData);
        // Auto-fill name if not provided
        if (!form.getValues('namaItem')) {
          form.setValue('namaItem', referenceData.namaItem || kodeItem);
        }
      } else {
        setEnrichedItemData(null);
      }
    }
  };

  const handleImport = async (data: ImportModalFormData) => {
    try {
      setIsProcessingFile(true);
      
      if (!selectedFile) {
        toast({
          title: "Import Error",
          description: "Please select a file to import.",
          variant: "destructive",
        });
        return;
      }

      const fileName = selectedFile.name.toLowerCase();
      const isCSVFile = fileName.endsWith('.csv') || fileName.endsWith('.txt');
      const isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.ods');

      console.log('🔍 File type detection:', {
        fileName: selectedFile.name,
        fileNameLower: fileName,
        isCSVFile,
        isExcelFile
      });

      if (!isCSVFile && !isExcelFile) {
        toast({
          title: "Import Error",
          description: "Please select a valid CSV, Excel (.xlsx, .xls), or OpenDocument (.ods) file.",
          variant: "destructive",
        });
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', data.mode);

      // Route to appropriate endpoint based on file type
      const endpoint = isCSVFile ? '/api/opening-stock/import-csv' : '/api/opening-stock/import-excel';
      
      console.log('🎯 Routing to endpoint:', endpoint);
      
      // Get the access token for authorization
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/opening-stock'] });
      setShowImportModal(false);
      setSelectedFile(null);
      setUploadedFileUrl(null);
      
      toast({
        title: "Import Successful",
        description: `${result.importedCount || 0} items imported successfully.`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Error",
        description: "Failed to process file. Please check the file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  // If user doesn't have permission to read opening stock, show access denied
  if (!canReadOpeningStock) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <Sidebar />
        <div className={cn("flex-1 flex items-center justify-center transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
          <Card className="max-w-md bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">You don't have permission to access opening stock management.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900" data-testid="opening-stock-page">
      <Sidebar />
      
      <div className={cn("flex-1 transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        <header className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Opening Stock Management</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage inventory opening stock and bulk imports</p>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Card className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Stock Management</CardTitle>
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
                            setEnrichedItemData(null);
                            setShowStockModal(true);
                          }}
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
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
                          className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-gray-800/50 hover:bg-white/30 dark:hover:bg-black/30"
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
                        <div className="grid gap-4">
                          {filteredStock.map((stock: any) => (
                            <Card key={stock.itemId} className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-gray-800/50 hover:bg-white/40 dark:hover:bg-black/40 transition-all duration-200">
                              <CardContent className="p-6">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Item Code</p>
                                      <p className="font-semibold text-gray-900 dark:text-white">{stock.kodeItem || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Item Name</p>
                                      <p className="font-medium text-gray-900 dark:text-white truncate">{stock.namaItem || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Quantity</p>
                                      <Badge variant="secondary" className="w-fit">
                                        {stock.qty || 0} pcs
                                      </Badge>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Serial Number</p>
                                      <p className="text-sm text-gray-700 dark:text-gray-300">{stock.sn || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Group / Family</p>
                                      <p className="text-sm text-gray-700 dark:text-gray-300">{stock.kelompok || '-'} / {stock.family || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Material</p>
                                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{stock.deskripsiMaterial || '-'}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 lg:ml-4">
                                    {canUpdateOpeningStock && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEdit(stock)}
                                        className="bg-white/20 dark:bg-black/20 backdrop-blur-sm border-white/30 dark:border-gray-700/30 hover:bg-blue-500/20 dark:hover:bg-blue-400/20"
                                        data-testid={`button-edit-${stock.itemId}`}
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {canDeleteOpeningStock && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDelete(stock)}
                                        className="bg-white/20 dark:bg-black/20 backdrop-blur-sm border-white/30 dark:border-gray-700/30 hover:bg-red-500/20 dark:hover:bg-red-400/20 hover:border-red-300 dark:hover:border-red-600"
                                        data-testid={`button-delete-${stock.itemId}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
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
                          
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Upload File
                              </label>
                              <p className="text-sm text-muted-foreground mb-3">
                                Upload CSV, Excel (.xlsx, .xls), or OpenDocument Spreadsheet (.ods) files with columns: sn, kodeItem, namaItem, qty
                              </p>
                              
                              {/* Unified File Upload */}
                              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center bg-white/10 dark:bg-black/10 backdrop-blur-sm">
                                <div className="space-y-4">
                                  <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                  <div>
                                    <label className="cursor-pointer">
                                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                                        Choose a file
                                      </span>
                                      <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls,.ods"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          setSelectedFile(file || null);
                                          setUploadedFileUrl(null);
                                        }}
                                        className="sr-only"
                                        data-testid="input-file-upload"
                                      />
                                    </label>
                                    <span className="text-sm text-gray-500 dark:text-gray-400"> or drag and drop</span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    CSV, Excel (.xlsx, .xls), or OpenDocument (.ods) files only
                                  </p>
                                  {selectedFile && (
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                        📄 {selectedFile.name}
                                      </p>
                                      <p className="text-xs text-green-600 dark:text-green-400">
                                        {(selectedFile.size / 1024).toFixed(1)} KB • Ready to import
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <Button 
                            type="submit" 
                            disabled={importStockMutation.isPending || isProcessingFile}
                            data-testid="button-submit-import"
                          >
                            {importStockMutation.isPending || isProcessingFile ? "Processing..." : "Import Data"}
                          </Button>
                          
                          {(selectedFile || uploadedFileUrl) && (
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={() => {
                                setSelectedFile(null);
                                setUploadedFileUrl(null);
                              }}
                              data-testid="button-clear-file"
                            >
                              Clear Files
                            </Button>
                          )}
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
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
                        <Input 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e);
                            handleItemCodeChange(e.target.value);
                          }}
                          data-testid="input-kode-item" 
                        />
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
                      <FormLabel>Nama Item</FormLabel>
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
              </div>
              
              {/* Show enriched data from reference sheet */}
              {enrichedItemData && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Auto-filled from Reference Sheet:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Kelompok:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">{enrichedItemData.kelompok || '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Family:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">{enrichedItemData.family || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-blue-800 dark:text-blue-200">Material:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">{enrichedItemData.deskripsiMaterial || '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800 dark:text-blue-200">Motif:</span>
                      <span className="ml-2 text-blue-700 dark:text-blue-300">{enrichedItemData.kodeMotif || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowStockModal(false);
                    setEnrichedItemData(null);
                  }}
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