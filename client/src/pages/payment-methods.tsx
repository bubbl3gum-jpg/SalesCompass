import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ImportModal } from "@/components/import-modal";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Edit3, Trash2, Plus, Upload, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportProgress } from "@/components/ImportProgress";

interface PaymentMethod {
  edcId: number;
  namaEdc: string;
  jenisEdc: string;
  biayaAdmin?: number;
}

export default function PaymentMethods() {
  const { user } = useStoreAuth();
  const { isExpanded } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState({
    namaEdc: '',
    jenisEdc: '',
    biayaAdmin: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null);

  // Fetch payment methods
  const { data: paymentMethods, isLoading, error } = useQuery({
    queryKey: ['/api/edc'],
    retry: false,
  });

  const filteredMethods = Array.isArray(paymentMethods) ? paymentMethods.filter((method: PaymentMethod) =>
    method.namaEdc?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    method.jenisEdc?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<PaymentMethod>) => {
      const response = await apiRequest('POST', '/api/edc', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/edc'] });
      setShowCreateModal(false);
      setFormData({ namaEdc: '', jenisEdc: '', biayaAdmin: '' });
      toast({
        title: "Success",
        description: "Payment method created successfully",
      });
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
        title: "Create Failed",
        description: (error as Error).message || "Failed to create payment method",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentMethod> }) => {
      const response = await apiRequest('PATCH', `/api/edc/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/edc'] });
      setShowEditModal(false);
      setEditingMethod(null);
      setFormData({ namaEdc: '', jenisEdc: '', biayaAdmin: '' });
      toast({
        title: "Success",
        description: "Payment method updated successfully",
      });
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
        title: "Update Failed",
        description: (error as Error).message || "Failed to update payment method",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/edc/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/edc'] });
      setDeletingMethod(null);
      toast({
        title: "Success",
        description: "Payment method deleted successfully",
      });
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
        title: "Delete Failed",
        description: (error as Error).message || "Failed to delete payment method",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      namaEdc: formData.namaEdc,
      jenisEdc: formData.jenisEdc,
      biayaAdmin: formData.biayaAdmin ? Number(formData.biayaAdmin) : undefined,
    };

    if (editingMethod) {
      updateMutation.mutate({ id: editingMethod.edcId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      namaEdc: method.namaEdc || '',
      jenisEdc: method.jenisEdc || '',
      biayaAdmin: method.biayaAdmin?.toString() || '',
    });
    setShowEditModal(true);
  };

  const handleImportComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/edc'] });
    setCurrentImportId(null);
    setIsImporting(false);
    setShowImportModal(false);
  }, [queryClient]);

  if (!user) {
    return <div>Please log in to access payment methods.</div>;
  }

  if (error) {
    if (isUnauthorizedError(error as Error)) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">Unauthorized access. Please log in again.</p>
            <button 
              onClick={() => window.location.replace("/api/login")}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Login
            </button>
          </div>
        </div>
      );
    }
    return <div className="p-4 text-red-600">Error loading payment methods: {(error as Error).message}</div>;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-950">
      <Sidebar />
      
      <div className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Payment Methods
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage EDC and payment methods for your stores
              </p>
            </div>

            <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl text-gray-900 dark:text-white">
                    Payment Methods
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowImportModal(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                      data-testid="button-import"
                    >
                      <Upload className="w-4 h-4" />
                      Import
                    </Button>
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2"
                      data-testid="button-create"
                    >
                      <Plus className="w-4 h-4" />
                      Add Payment Method
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search payment methods..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                {/* Import Progress */}
                {currentImportId && (
                  <div className="mb-6">
                    <ImportProgress 
                      importId={currentImportId} 
                      onComplete={handleImportComplete}
                    />
                  </div>
                )}

                {/* Payment Methods List */}
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredMethods.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No payment methods found matching your search.' : 'No payment methods found. Add one to get started.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMethods.map((method: PaymentMethod) => (
                      <div
                        key={method.edcId}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        data-testid={`payment-method-${method.edcId}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {method.namaEdc}
                            </h3>
                            <Badge variant="secondary">
                              {method.jenisEdc}
                            </Badge>
                          </div>
                          {method.biayaAdmin && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Admin Fee: Rp {method.biayaAdmin.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(method)}
                            data-testid={`button-edit-${method.edcId}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingMethod(method)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-${method.edcId}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
          setEditingMethod(null);
          setFormData({ namaEdc: '', jenisEdc: '', biayaAdmin: '' });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? 'Update' : 'Create'} Payment Method
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="namaEdc">Payment Method Name *</Label>
              <Input
                id="namaEdc"
                value={formData.namaEdc}
                onChange={(e) => setFormData({ ...formData, namaEdc: e.target.value })}
                required
                data-testid="input-nama-edc"
              />
            </div>
            
            <div>
              <Label htmlFor="jenisEdc">Type *</Label>
              <Input
                id="jenisEdc"
                value={formData.jenisEdc}
                onChange={(e) => setFormData({ ...formData, jenisEdc: e.target.value })}
                required
                data-testid="input-jenis-edc"
              />
            </div>

            <div>
              <Label htmlFor="biayaAdmin">Admin Fee</Label>
              <Input
                id="biayaAdmin"
                type="number"
                value={formData.biayaAdmin}
                onChange={(e) => setFormData({ ...formData, biayaAdmin: e.target.value })}
                data-testid="input-biaya-admin"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingMethod(null);
                  setFormData({ namaEdc: '', jenisEdc: '', biayaAdmin: '' });
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {editingMethod ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMethod} onOpenChange={() => setDeletingMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingMethod?.namaEdc}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMethod && deleteMutation.mutate(deletingMethod.edcId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        tableName="edc"
        title="Import Payment Methods"
        queryKey="/api/edc"
        endpoint="/api/import/edc"
      />
    </div>
  );
}