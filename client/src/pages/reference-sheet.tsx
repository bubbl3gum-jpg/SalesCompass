import { useState, useCallback } from "react";
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

interface ReferenceItem {
  refId: number;
  kodeItem: string;
  namaItem: string;
  kelompok?: string;
  family?: string;
  originalCode?: string;
  color?: string;
  kodeMaterial?: string;
  deskripsiMaterial?: string;
  kodeMotif?: string;
  deskripsiMotif?: string;
}

export default function ReferenceSheet() {
  const { user } = useStoreAuth();
  const { isExpanded } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [formData, setFormData] = useState({
    kodeItem: '',
    namaItem: '',
    kelompok: '',
    family: '',
    originalCode: '',
    color: '',
    kodeMaterial: '',
    deskripsiMaterial: '',
    kodeMotif: '',
    deskripsiMotif: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ReferenceItem | null>(null);

  // Fetch reference sheet items
  const { data: referenceItems, isLoading, error } = useQuery({
    queryKey: ['/api/reference-sheets'],
    retry: false,
  });

  const filteredItems = Array.isArray(referenceItems) ? referenceItems.filter((item: ReferenceItem) =>
    item.kodeItem?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.namaItem?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kelompok?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.family?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<ReferenceItem>) => {
      const response = await apiRequest('POST', '/api/reference-sheets', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
      setShowCreateModal(false);
      setFormData({
        kodeItem: '', namaItem: '', kelompok: '', family: '', originalCode: '',
        color: '', kodeMaterial: '', deskripsiMaterial: '', kodeMotif: '', deskripsiMotif: ''
      });
      toast({
        title: "Success",
        description: "Item created successfully",
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
        description: (error as Error).message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ReferenceItem> }) => {
      const response = await apiRequest('PATCH', `/api/reference-sheets/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
      setShowEditModal(false);
      setEditingItem(null);
      setFormData({
        kodeItem: '', namaItem: '', kelompok: '', family: '', originalCode: '',
        color: '', kodeMaterial: '', deskripsiMaterial: '', kodeMotif: '', deskripsiMotif: ''
      });
      toast({
        title: "Success",
        description: "Item updated successfully",
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
        description: (error as Error).message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/reference-sheets/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
      setDeletingItem(null);
      toast({
        title: "Success",
        description: "Item deleted successfully",
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
        description: (error as Error).message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.refId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item: ReferenceItem) => {
    setEditingItem(item);
    setFormData({
      kodeItem: item.kodeItem || '',
      namaItem: item.namaItem || '',
      kelompok: item.kelompok || '',
      family: item.family || '',
      originalCode: item.originalCode || '',
      color: item.color || '',
      kodeMaterial: item.kodeMaterial || '',
      deskripsiMaterial: item.deskripsiMaterial || '',
      kodeMotif: item.kodeMotif || '',
      deskripsiMotif: item.deskripsiMotif || '',
    });
    setShowEditModal(true);
  };

  const handleImportComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/reference-sheets'] });
    setCurrentImportId(null);
    setIsImporting(false);
    setShowImportModal(false);
  }, [queryClient]);

  if (!user) {
    return <div>Please log in to access reference sheet.</div>;
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
    return <div className="p-4 text-red-600">Error loading reference sheet: {(error as Error).message}</div>;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-950">
      <Sidebar />
      
      <div className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out", isExpanded ? "ml-64" : "ml-16")}>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Reference Sheet
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage items master data and product information
              </p>
            </div>

            <Card className="bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl text-gray-900 dark:text-white">
                    Items Master Data
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
                      Add Item
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
                      placeholder="Search items by code, name, group, or family..."
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

                {/* Items List */}
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
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No items found matching your search.' : 'No items found. Add one to get started.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredItems.map((item: ReferenceItem) => (
                      <div
                        key={item.refId}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        data-testid={`reference-item-${item.refId}`}
                      >
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {item.kodeItem}
                              </h3>
                              {item.kelompok && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.kelompok}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                              {item.namaItem}
                            </p>
                            {item.family && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                Family: {item.family}
                              </p>
                            )}
                          </div>
                          
                          <div>
                            {item.kodeMaterial && (
                              <div className="mb-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Material: </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.kodeMaterial}</span>
                              </div>
                            )}
                            {item.deskripsiMaterial && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {item.deskripsiMaterial}
                              </p>
                            )}
                          </div>
                          
                          <div>
                            {item.kodeMotif && (
                              <div className="mb-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Motif: </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.kodeMotif}</span>
                              </div>
                            )}
                            {item.color && (
                              <div className="mb-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Color: </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.color}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.refId}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingItem(item)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-${item.refId}`}
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
          setEditingItem(null);
          setFormData({
            kodeItem: '', namaItem: '', kelompok: '', family: '', originalCode: '',
            color: '', kodeMaterial: '', deskripsiMaterial: '', kodeMotif: '', deskripsiMotif: ''
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Update' : 'Create'} Reference Item
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kodeItem">Item Code *</Label>
                <Input
                  id="kodeItem"
                  value={formData.kodeItem}
                  onChange={(e) => setFormData({ ...formData, kodeItem: e.target.value })}
                  required
                  data-testid="input-kode-item"
                />
              </div>
              
              <div>
                <Label htmlFor="namaItem">Item Name *</Label>
                <Input
                  id="namaItem"
                  value={formData.namaItem}
                  onChange={(e) => setFormData({ ...formData, namaItem: e.target.value })}
                  required
                  data-testid="input-nama-item"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kelompok">Group</Label>
                <Input
                  id="kelompok"
                  value={formData.kelompok}
                  onChange={(e) => setFormData({ ...formData, kelompok: e.target.value })}
                  data-testid="input-kelompok"
                />
              </div>
              
              <div>
                <Label htmlFor="family">Family</Label>
                <Input
                  id="family"
                  value={formData.family}
                  onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                  data-testid="input-family"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="originalCode">Original Code</Label>
                <Input
                  id="originalCode"
                  value={formData.originalCode}
                  onChange={(e) => setFormData({ ...formData, originalCode: e.target.value })}
                  data-testid="input-original-code"
                />
              </div>
              
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  data-testid="input-color"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kodeMaterial">Material Code</Label>
                <Input
                  id="kodeMaterial"
                  value={formData.kodeMaterial}
                  onChange={(e) => setFormData({ ...formData, kodeMaterial: e.target.value })}
                  data-testid="input-kode-material"
                />
              </div>
              
              <div>
                <Label htmlFor="kodeMotif">Motif Code</Label>
                <Input
                  id="kodeMotif"
                  value={formData.kodeMotif}
                  onChange={(e) => setFormData({ ...formData, kodeMotif: e.target.value })}
                  data-testid="input-kode-motif"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="deskripsiMaterial">Material Description</Label>
              <Input
                id="deskripsiMaterial"
                value={formData.deskripsiMaterial}
                onChange={(e) => setFormData({ ...formData, deskripsiMaterial: e.target.value })}
                data-testid="input-deskripsi-material"
              />
            </div>

            <div>
              <Label htmlFor="deskripsiMotif">Motif Description</Label>
              <Input
                id="deskripsiMotif"
                value={formData.deskripsiMotif}
                onChange={(e) => setFormData({ ...formData, deskripsiMotif: e.target.value })}
                data-testid="input-deskripsi-motif"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingItem(null);
                  setFormData({
                    kodeItem: '', namaItem: '', kelompok: '', family: '', originalCode: '',
                    color: '', kodeMaterial: '', deskripsiMaterial: '', kodeMotif: '', deskripsiMotif: ''
                  });
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.kodeItem} - {deletingItem?.namaItem}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteMutation.mutate(deletingItem.refId)}
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
        tableName="reference-sheet"
        title="Import Reference Sheet"
        queryKey="/api/reference-sheets"
        endpoint="/api/import/reference-sheet"
      />
    </div>
  );
}